const uid = () => Math.random().toString(36).slice(2, 10);
const now = () => Date.now();

export { uid, now };