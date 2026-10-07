// Razorpay Standard Checkout is a third-party <script>, not an npm package, so it
// must be fetched at runtime. This module loads it exactly once and caches the
// promise, so navigating between pages (or clicking twice fast) cannot inject a
// duplicate tag.
//
// Failure is handled rather than assumed: if the checkout script cannot load we
// resolve false and the caller shows a real error instead of throwing on
// `new window.Razorpay(...)` being undefined.

let scriptPromise = null;

export function loadRazorpayScript() {
  if (window.Razorpay) return Promise.resolve(true);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;

    script.onload = () => {
      if (window.Razorpay) {
        resolve(true);
      } else {
        // Loaded but did not register - treat as failure and allow a retry.
        scriptPromise = null;
        script.remove();
        resolve(false);
      }
    };

    script.onerror = () => {
      scriptPromise = null;
      script.remove();
      resolve(false);
    };

    document.body.appendChild(script);
  });

  return scriptPromise;
}

export default loadRazorpayScript;