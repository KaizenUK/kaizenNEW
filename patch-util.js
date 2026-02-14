import util from 'node:util';

// Force inject inherits if it's missing from the global or util object
if (typeof util.inherits !== 'function') {
  util.inherits = function (ctor, superCtor) {
    if (superCtor) {
      ctor.super_ = superCtor;
      Object.setPrototypeOf(ctor.prototype, superCtor.prototype);
    }
  };
}