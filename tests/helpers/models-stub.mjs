// Test stand-in for public/js/models.js (the real one needs a browser and WebGL).
export const has = () => false;
export const kinds = () => [];
export const setCamera = () => {};
export const preload = async () => false;
export const createModelPerson = () => { throw new Error('not available in tests'); };
