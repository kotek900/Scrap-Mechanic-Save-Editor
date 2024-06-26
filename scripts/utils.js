export function writeFloatToData(data, location, float) {
    const view = new DataView(data.buffer, location);
    view.setFloat32(0, float);
}

export function readFloatFromData(data, location) {
    const view = new DataView(data.buffer, location);
    return view.getFloat32(0);
}

export function writeInt16ToData(data, location, int) {
    const view = new DataView(data.buffer, location);
    view.setInt16(0, int);
}

export function readInt16FromData(data, location) {
    const view = new DataView(data.buffer, location);
    return view.getInt16(0);
}

export function readUUID(data, location) {
    let uuid = "";
    for (let i = 0; i < 16; i++) {
        if (data[location-i]==undefined) return undefined;
        uuid += data[location-i].toString(16).padStart(2, '0');
        if (i === 3 || i === 5 || i === 7 || i === 9) {
            uuid += "-";
        }
    }
    return uuid;
}
