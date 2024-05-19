import * as THREE from 'three';

import { editor } from "editor";
import { resourceManager } from "resource_manager";
import { readUUID, readInt16FromData, writeInt16ToData } from "utils";

// Fake "enum"
export const PartType = {
    BLOCK: 0x1f,
    PART: 0x20
};

let blockTexture = new THREE.TextureLoader().load( "blockTexture.png" );
blockTexture.wrapS = THREE.RepeatWrapping;
blockTexture.wrapT = THREE.RepeatWrapping;

export class ChildShape {
    constructor(data) {
        this.id = data[0];
        this.bodyID = data[1];
        this.uuid = readUUID(data[2], 26);
        this.data = data[2];
        this.color = (data[2][40] << 16) + (data[2][39] << 8) + data[2][38];
        this.type = data[2][1];

        this.jointIdA = [];
        this.jointIdB = [];

        editor.rigidBodies[this.bodyID].addChildShape(this.id);

        switch(this.type) {
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


        // add shape to the object list tab

        let containsDetails = false;

        if (containsDetails) {

            let detailsElement = document.createElement("details");
            let summaryElement = document.createElement("summary");

            summaryElement.textContent = "Shape " + this.id;

            detailsElement.appendChild(summaryElement);
            editor.rigidBodies[this.bodyID].objectListElement.appendChild(detailsElement);

            this.objectListElement = detailsElement;

        } else {

            let infoElement = document.createElement("div");

            infoElement.textContent = "Shape " + this.id;

            editor.rigidBodies[this.bodyID].objectListElement.appendChild(infoElement);

            this.objectListElement = infoElement;

        }
    }

    delete() {
        editor.rigidBodies[this.bodyID].group.remove(this.mesh);
        editor.rigidBodies[this.bodyID].removeChildShape(this.id);
        this.mesh.remove();
        const statement = editor.db.prepare("DELETE FROM ChildShape WHERE id = ?;");
        statement.run([this.id]);

        this.objectListElement.remove();
    }

    createMesh() {
        if (this.mesh != undefined) {
            editor.rigidBodies[this.bodyID].group.remove(this.mesh);
            this.mesh.remove();
        }

        switch(this.type) {
        case PartType.BLOCK:


            const material = new THREE.MeshLambertMaterial({
                color: this.color,
                map: blockTexture
            });

            const geometry = new THREE.BoxGeometry(this.size.z, this.size.x, this.size.y);
            let pos = geometry.getAttribute( 'position' )
            let uv = geometry.getAttribute( 'uv' );
            for( let i=0; i<pos.count; i++ ) {
                let x = (this.size.z-1)/2 + (pos.getX(i)+0.5),
                    y = (this.size.x-1)/2 + (pos.getY(i)+0.5),
                    z = (this.size.y-1)/2 + (pos.getZ(i)+0.5);

                if( i<8 ) uv.setXY( i, z, y );
                else if( i<16 ) uv.setXY( i, x, z );
                else uv.setXY( i, y, x );
            }

            this.mesh = new THREE.Mesh(geometry, material);

            break;
        case PartType.PART:
            this.mesh = resourceManager.unknownModel.scene.clone();
            break;
        }

        // Convert to a different coordinate system
        this.mesh.position.y = this.position.x;
        this.mesh.position.z = this.position.y;
        this.mesh.position.x = -this.position.z;

        if (this.type == PartType.BLOCK) {
            this.mesh.position.y += this.size.x / 2;
            this.mesh.position.z += this.size.y / 2;
            this.mesh.position.x -= this.size.z / 2;
        }

        this.mesh.childShapeID = this.id;

        editor.rigidBodies[this.bodyID].group.add(this.mesh);
    }

    updateDatabase() {
        // partType
        this.data[1] = this.type;

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

        switch(this.type) {
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

        const statement = editor.db.prepare("UPDATE ChildShape SET data = ? WHERE id = ?;");
        statement.run([this.data, this.id]);
    }
}
