try {
  console.log("top", window.top !== window.self);
} catch(e) {
  console.log("error", e);
}
