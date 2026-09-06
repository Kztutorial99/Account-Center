/* Cache skema per proses.
   Semua DDL di sini pakai "IF NOT EXISTS", jadi cukup dijalankan sekali per
   instance serverless. Tanpa cache ini setiap request membayar belasan
   round-trip ke database sebelum query aslinya jalan — itu penyebab utama
   sinkronisasi terasa lambat. */
function once(fn) {
  let pending = null;
  return function cached(...args) {
    if (!pending) {
      pending = Promise.resolve()
        .then(() => fn(...args))
        .catch((err) => { pending = null; throw err; });
    }
    return pending;
  };
}

module.exports = { once };
