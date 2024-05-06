export function updateSelectedDatabase() {
    if (selected.type=="GameInfo") {
        Game.updateDatabase();
    } else if (selected.type=="ChildShape") {
        ChildShapes[selected.objectID].updateDatabase();
    } else if (selected.type=="RigidBody") {
        RigidBodies[selected.objectID].updateDatabase();
    }
}

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
    let UUID = "";
    for (let i = 0; i < 16; i++) {
        UUID += data[location-i].toString(16).padStart(2, '0');
        if (i === 3 || i === 5 || i === 7 || i === 9) {
            UUID += "-";
        }
    }
    return UUID;
}
