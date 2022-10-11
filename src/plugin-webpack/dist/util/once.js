"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = void 0;
var _default = (fn1, fn2)=>{
    let once = true;
    let val;
    const make = (fn)=>(...args)=>{
            if (once) {
                val = fn(...args);
                once = false;
            }
            return val;
        }
    ;
    return [
        make(fn1),
        make(fn2)
    ];
};
exports.default = _default;

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy91dGlsL29uY2UudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyogZXNsaW50IFwiYXJyb3ctcGFyZW5zXCI6IFwib2ZmXCIsIFwiQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVwiOiBcIm9mZlwiICovXG5leHBvcnQgZGVmYXVsdCA8QSwgQj4oZm4xOiBBLCBmbjI6IEIpOiBbQSwgQl0gPT4ge1xuICBsZXQgb25jZSA9IHRydWU7XG4gIGxldCB2YWw6IGFueTtcbiAgY29uc3QgbWFrZSA9IDxUPihmbjogVCk6IFQgPT5cbiAgICAoKC4uLmFyZ3M6IGFueVtdKSA9PiB7XG4gICAgICBpZiAob25jZSkge1xuICAgICAgICB2YWwgPSAoZm4gYXMgYW55KSguLi5hcmdzKTtcbiAgICAgICAgb25jZSA9IGZhbHNlO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHZhbDtcbiAgICB9KSBhcyB1bmtub3duIGFzIFQ7XG4gIHJldHVybiBbbWFrZShmbjEpLCBtYWtlKGZuMildO1xufTtcbiJdLCJuYW1lcyI6WyJmbjEiLCJmbjIiLCJvbmNlIiwidmFsIiwibWFrZSIsImZuIiwiYXJncyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Z0JBQ3NCQSxHQUFNLEVBQUVDLEdBQU0sR0FBYSxDQUFDO0lBQ2hELEdBQUcsQ0FBQ0MsSUFBSSxHQUFHLElBQUk7SUFDZixHQUFHLENBQUNDLEdBQUc7SUFDUCxLQUFLLENBQUNDLElBQUksSUFBT0MsRUFBSyxPQUNmQyxJQUFJLEdBQVksQ0FBQztZQUNwQixFQUFFLEVBQUVKLElBQUksRUFBRSxDQUFDO2dCQUNUQyxHQUFHLEdBQUlFLEVBQUUsSUFBWUMsSUFBSTtnQkFDekJKLElBQUksR0FBRyxLQUFLO1lBQ2QsQ0FBQztZQUNELE1BQU0sQ0FBQ0MsR0FBRztRQUNaLENBQUM7O0lBQ0gsTUFBTSxDQUFDLENBQUNDO1FBQUFBLElBQUksQ0FBQ0osR0FBRztRQUFHSSxJQUFJLENBQUNILEdBQUc7SUFBQyxDQUFDO0FBQy9CLENBQUMifQ==