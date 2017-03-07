fs = require('fs');
function codeStream(input){
    var pos=0 , line = 1, col = 0;
    return {
        next : next,
        peek : peek,
        empty: empty,
        err : err,
    };
    function peek(){
        return input.charAt(pos);
    }
    function next() {
        var ch = input.charAt(pos++);
        if(ch == '\n') line++,col =0; else col++;
        return ch;
    }
    function empty() {
        return peek()=="";
    }
    function err(msg){
        throw new Error(msg + " ("+line+":"+col+")");
    }

};

function tokenStream(input) {
    var current = null;
    var keywords = ["اذا","اواذا","او" , "وظيفة" , "صحيح" , "خطأ" , "فان"];
    return {
        next : next,
        peek : peek,
        empty : empty,
        err : input.err
    };
    function is_kw(x){
        return keywords.indexOf(x) >= 0;
    }
    function is_digit(ch) {
        return /[0-9]/i.test(ch);
    }
    function is_id_start(ch) {
        return /[أ-ي_]/i.test(ch);
    }
    function is_id(ch) {
        return is_id_start(ch) || "?!-<>=0123456789".indexOf(ch) >= 0;
    }
    function is_op_char(ch) {
        return "+-*/%=&|<>!".indexOf(ch) >= 0;
    }
    function is_punc(ch) {
        return "؛,(){}[]".indexOf(ch) >= 0;
    }
    function is_whitespace(ch) {
        return " \t\n".indexOf(ch) >= 0;
    }
    function read_while(predicate) {
        var str = "";
        while (!input.empty() && predicate(input.peek()))
            str += input.next();
        return str;
    }
    function read_number() {
        var has_dot=false;
        var number = read_while(
            function(ch) {
                if(ch == "."){
                    if(has_dot) return false;
                    has_dot = true
                    return true;
                }
                return is_digit(ch);
            }
        );
        return {type: "num" , value: parseFloat(number)};
    }

    function read_ident(){
        var id = read_while(is_id);
        return {type: is_kw(id) ? "kw" : "var", value: id};
    }

    function read_escaped(end) {
        var escaped = false, str = "";
        input.next();
        while (!input.empty()) {
            var ch = input.next();
            if (escaped) {
                str += ch;
                escaped = false;
            } else if (ch == "\\") {
                escaped = true;
            } else if (ch == end) {
                break;
            } else {
                str += ch;
            }
        }
        return str;
    }

    function read_string() {
        return {type: "str" , value : read_escaped('"')};
    }

    function skip_comment() {
        read_while(function(ch){return ch != "\n";});
        input.next();
    }



    function core(){
        read_while(is_whitespace);
        if(input.empty()) return null;
        var ch = input.peek();
        if(ch == "#"){
            skip_comment();
            return core();
        }
        if(ch == '"') return read_string();
        if (is_digit(ch)) return read_number();
        if (is_id_start(ch)) return read_ident();
        if (is_punc(ch)) return {
            type  : "punc",
            value : input.next()
        };
        if (is_op_char(ch)) return {
            type  : "op",
            value : read_while(is_op_char)
        };
        input.err("Can't handle character: " + ch);
    }

    function peek() {
        return current || (current = core());
    }
    function next() {
        var tok = current;
        current = null;
        return tok || core();
    }
    function empty() {
        return peek() == null;
    }
}


var FALSE = { type: "bool", value: false };
function parse(input) {
    //
    var ifstructure = ["(","،",")","{","}"];
    var PRECEDENCE = {
        "=": 1,
        "||": 2,
        "&&": 3,
        "<": 7, ">": 7, "<=": 7, ">=": 7, "==": 7, "!=": 7,
        "+": 10, "-": 10,
        "*": 20, "/": 20, "%": 20,
    };

    return parse_toplevel();

    function is_kw(ch){
        var nxt = input.peek();
        return nxt.type == "kw" && nxt.value == ch;
    }
    function is_punc(ch){
        var nxt = input.peek();
        return nxt && nxt.type == "punc" &&  nxt.value == ch;
    }
    function is_op(op) {
        var tok = input.peek();
        return tok && tok.type == "op" && (!op || tok.value == op) && tok;
    }
    function skip_punc(x) {
        if(is_punc(x)) input.next();
        else input.err("Expecting punctuation: \"" + x + "\"");
    }
    function skip_kw(x) {
        if(is_kw(x)) input.next();
        else input.err("Expecting keyword: \"" + x + "\"");
    }
    function skip_op(op) {
        if (is_op(op)) input.next();
        else input.err("Expecting operator: \"" + op + "\"");
    }
    function unexpected() {
        input.err("Unexpected token: " + JSON.stringify(input.peek()));
    }
    function parseFunction() {
        //console.log("parseFunction called");
        return { type : "func" , vars: delimiter(ifstructure[0],ifstructure[1],ifstructure[2],parse_varname), body: parse_expression()};
    }
    function delimiter(start,separator,end,parser_type){
        //console.log("delimiter called");
        var vars = [];
        //console.log(is_punc(input.peek().value));
        skip_punc(input.peek().value);
        //console.log("   skip punc");
        while (!input.empty()) {
            if(is_punc(end)) break;
            if(vars.length && is_punc(separator)) skip_punc(separator);
            if(is_punc(end)) break;
            vars.push(parser_type());
        }
        skip_punc(end);
        return vars;
    }

    function parse_varname() {
        var name = input.next();
        if(name.type != "var") input.err("Expecting variable name");
        return name;
    }
    function parse_bool() {
        return {
            type  : "bool",
            value : input.next().value == "true"
        };
    }
    function parse_if() {
        skip_kw("اذا");
        var cond = parse_expression();
        var then = parse_expression();
        var ret = { type: "if", cond:cond, then,then};
        if(is_kw("او")){
            input.next();
            ret.else = parse_expression();
        }
        return ret;
    }

    function parse_expression() {
        return maybe_call(function(){
            return maybe_binary(parse_core(), 0);
        });
    }

    function parse_core(){
        //console.log("parse_core next value :"+input.peek().value);
        return maybe_call(function() {
                if(is_punc(ifstructure[0])){  // (
                    //console.log(input.peek());
                    input.next();
                    var exp = parse_expression();
                    skip_punc(ifstructure[2]); // )
                    return exp;
                }
                if(is_punc(ifstructure[3])) return parse_prog();
                if (is_kw("اذا")) {
                    //console.log("parse_if");
                    return parse_if();}
                if (is_kw("صحيح") || is_kw("خطأ")) return parse_bool();
                if (is_kw("وظيفة")) {
                    //console.log("function found");
                    input.next();
                    return parseFunction();
                }
                var nxt = input.peek();
                if (nxt.type == "var" || nxt.type == "num" || nxt.type == "str"){
                    nxt = input.next();
                    return nxt;
                }
                unexpected();
        });
    }

    function parse_prog() {
        var prog = delimiter(ifstructure[3], "؛", ifstructure[4], parse_expression);
        if (prog.length == 0) return FALSE;
        if (prog.length == 1) return prog[0];
        return { type: "prog", prog: prog };
    }

    function parse_toplevel(){
        //console.log("parse_toplevel");
        var prog =[];
        while (!input.empty()) {
            prog.push(parse_expression());
            if(!input.empty() && is_punc("؛")) skip_punc("؛");

        }
        return {type : "prog" , prog: prog};
    }

    function maybe_call(expr) {
        //console.log("maybe_call");
        expr = expr();
        return is_punc(ifstructure[0]) ? parse_call(expr) : expr;
    }

    function parse_call(func) {
        return {
            type: "call",
            func: func,
            args: delimiter(ifstructure[0], ifstructure[1], ifstructure[2], parse_expression)
        };
    }

    function maybe_binary(left, my_prec) {
        var tok = is_op();
        if (tok) {
            var his_prec = PRECEDENCE[tok.value];
            if (his_prec > my_prec) {
                input.next();
                var right = maybe_binary(parse_core(), his_prec) // (*);
                var binary = {
                    type     : tok.value == "=" ? "assign" : "binary",
                    operator : tok.value,
                    left     : left,
                    right    : right
                };
                return maybe_binary(binary, my_prec);
            }
        }
        return left;
    }

}


function Environment(parent) {
    this.vars = Object.create(parent ? parent.vars : null);
    this.parent = parent;
}
Environment.prototype = {
    extend: function() {
        return new Environment(this);
    },
    lookup: function(name) {
        var scope = this;
        while (scope) {
            if (Object.prototype.hasOwnProperty.call(scope.vars, name))
                return scope;
            scope = scope.parent;
        }
    },
    get: function(name) {
        //console.log(this.vars);  // TODO read this
        if (name in this.vars)
            return this.vars[name];
        throw new Error("Undefined variable " + name);
    },
    set: function(name, value) {
        var scope = this.lookup(name);
        if (!scope && this.parent)
            throw new Error("Undefined variable " + name);
        return (scope || this).vars[name] = value;
    },
    def: function(name, value) {
        //console.log(name);
        return this.vars[name] = value;
    }
};

function evaluate(exp, env) {
    switch (exp.type) {
      case "num":
      case "str":
      case "bool":
        return exp.value;

      case "var":
        //console.log(exp.value); //TODO check lo
        return env.get(exp.value);

      case "assign":
        if (exp.left.type != "var")
            throw new Error("Cannot assign to " + JSON.stringify(exp.left));
        return env.set(exp.left.value, evaluate(exp.right, env));

      case "binary":
        return apply_op(exp.operator,
                        evaluate(exp.left, env),
                        evaluate(exp.right, env));

      case "func":
        return make_lambda(env, exp);

      case "if":
        var cond = evaluate(exp.cond, env);
        if (cond !== false) return evaluate(exp.then, env);
        return exp.else ? evaluate(exp.else, env) : false;

      case "prog":
        var val = false;
        exp.prog.forEach(function(exp){ val = evaluate(exp, env) });
        return val;

      case "call":
        var func = evaluate(exp.func, env);
        return func.apply(null, exp.args.map(function(arg){
            return evaluate(arg, env);
        }));

      default:
        throw new Error("I don't know how to evaluate " + exp.type);
    }
}

function apply_op(op, a, b) {
    function num(x) {
        if (typeof x != "number")
            throw new Error("Expected number but got " + x);
        return x;
    }
    function div(x) {
        if (num(x) == 0)
            throw new Error("Divide by zero");
        return x;
    }
    switch (op) {
      case "+": return num(a) + num(b);
      case "-": return num(a) - num(b);
      case "*": return num(a) * num(b);
      case "/": return num(a) / div(b);
      case "%": return num(a) % div(b);
      case "&&": return a !== false && b;
      case "||": return a !== false ? a : b;
      case "<": return num(a) < num(b);
      case ">": return num(a) > num(b);
      case "<=": return num(a) <= num(b);
      case ">=": return num(a) >= num(b);
      case "==": return a === b;
      case "!=": return a !== b;
    }
    throw new Error("Can't apply operator " + op);
}

function make_lambda(env, exp) {
    function lambda() {
        var names = exp.vars;
        var scope = env.extend();
        for (var i = 0; i < names.length; ++i)
            scope.def(names[i].value, i < arguments.length ? arguments[i] : false);
        return evaluate(exp.body, scope);
    }
    return lambda;
}

/* -----[ entry point for NodeJS ]----- */

var globalEnv = new Environment();

globalEnv.def("اكتب", function(val){
    console.log(val);
});




fs.readFile('program.is', 'utf8', function(err,data){
    if (err) {
        console.log('يوجد خطأ في قراءة الملف');
    }
    var code = codeStream(data);
    tokens = tokenStream(code);
    var ast = parse(tokens);
    evaluate(ast, globalEnv);

});
