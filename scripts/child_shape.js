// Fake "enum"
const PartType = {
    BLOCK: 0x1f,
    PART: 0x20
};

export class ChildShape {
    constructor(data) {
        this.id = data[0];
        this.bodyID = data[1];
        this.uuid = readUUID(data[2], 26);
        this.data = data[2];
        this.color = (data[2][40] << 16) + (data[2][39] << 8) + data[2][38];
        this.partType = data[2][1];

        RigidBodies[this.bodyID].addChildShape(this.id);

        switch(this.partType) {
        case PartType.BLOCK:
            this.size = {
                x: data[2][0x2E], 
                y: data[2][0x2C], 
                z: data[2][0x2A] 
            };
            break;
        case PartType.PART:
            this.rotation = data[2][41];
            break;
        }

        this.position = {
            x: readInt16FromData(data[2], 35),
            y: readInt16FromData(data[2], 33),
            z: readInt16FromData(data[2], 31)
        }

        this.createMesh();
    }

    delete() {
        RigidBodies[this.bodyID].group.remove(this.mesh);
        RigidBodies[this.bodyID].removeChildShape(this.id);
        this.mesh.remove();
        let statement = db.prepare("DELETE FROM ChildShape WHERE id = ?;");
        statement.run([this.id]);
    }

    createMesh() {
        if (this.mesh != undefined) {
            RigidBodies[this.bodyID].group.remove(this.mesh);
            this.mesh.remove();
        }

        const material = new THREE.MeshLambertMaterial({
            color: this.color
        });

        switch(this.partType) {
        case PartType.BLOCK:
            const geometry = new THREE.BoxGeometry(this.size.z, this.size.x, this.size.y);
            this.mesh = new THREE.Mesh(geometry, material);
            break;
        case PartType.PART:
            this.mesh = unknownModel.scene.clone();
            break;
        }

        // Convert to a different coordinate system
        this.mesh.position.y = this.position.x;
        this.mesh.position.z = this.position.y;
        this.mesh.position.x = -this.position.z;

        if (this.partType == PartType.BLOCK) {
            this.mesh.position.y += this.size.x / 2;
            this.mesh.position.z += this.size.y / 2;
            this.mesh.position.x -= this.size.z / 2;
        }

        this.mesh.ChildShapeID = this.id;

        RigidBodies[this.bodyID].group.add(this.mesh);
    }

    updateDatabase() {
        // partType
        this.data[1] = this.partType;

        // color
        let color = this.color
        let blue = color%256;
        color = (color-blue)/256;
        let green = color%256;
        color = (color-green)/256;
        let red = color;
        this.data[40] = red;
        this.data[39] = green;
        this.data[38] = blue;

        // UUID
        let i = 0;
        let uuidPosition = 26;
        while (i < 36) {
            this.data[uuidPosition--] = parseInt(this.uuid[i]+this.uuid[i+1], 16);
            i+=(i==6||i==11||i==16||i==21) ? 3 : 2;
        }

        // position
        writeInt16ToData(this.data, 35, this.position.x);
        writeInt16ToData(this.data, 33, this.position.y);
        writeInt16ToData(this.data, 31, this.position.z);

        switch(this.partType) {
        case PartType.BLOCK:
            //size
            this.data[0x2E] = this.size.x;
            this.data[0x2C] = this.size.y;
            this.data[0x2A] = this.size.z;
            break;
        default:
            // rotation (assuming type is part) TODO
            // assert not reached
            console.assert(false);
            break;
        }

        let statement = db.prepare("UPDATE ChildShape SET data = ? WHERE id = ?;");
        statement.run([this.data, this.id]);
    }
}