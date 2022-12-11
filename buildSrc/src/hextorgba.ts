export const isValidHex = (hex: string) =>
  /^#([A-Fa-f0-9]{3,4}){1,2}$/.test(hex);

const getChunksFromString = (st: string, chunkSize: number) =>
  st.match(new RegExp(`.{${chunkSize}}`, "g"));

const convertHexUnitTo256 = (hexStr: string) =>
  parseInt(hexStr.repeat(2 / hexStr.length), 16);

const getAlphafloat = (a: number | undefined, alpha: number) => {
  if (typeof a === "undefined") {
    return alpha;
  }
  if (typeof alpha != "number" || alpha < 0 || alpha > 1) {
    return 1;
  }
  return a / 255;
};

export const hexToRGBA = (hex: string) => {
  const chunkSize = Math.floor((hex.length - 1) / 3);
  const hexArr = getChunksFromString(hex.slice(1), chunkSize);
  if (hexArr === null) {
    throw new Error();
  }
  const [r, g, b, a] = hexArr.map(convertHexUnitTo256);
  return [r, g, b, a];
};
