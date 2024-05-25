import * as THREE from 'three';

import { editor, SelectionType } from "editor";
import { Vector3ObjectProperty } from "object_property";
import { readFloatFromData, writeFloatToData } from "utils";

export class RigidBody {
    constructor(data) {
        this.childShapes = [];

        this.data = data[2];
        this.id = data[0];
        this.worldID = data[1];
        this.position = {
            x: readFloatFromData(this.data, 0x2B),
            y: readFloatFromData(this.data, 0x2F),
            z: readFloatFromData(this.data, 0x33)
        }

        const QA = readFloatFromData(this.data, 27);
        const QB = readFloatFromData(this.data, 31);
        const QC = readFloatFromData(this.data, 35);
        const QD = readFloatFromData(this.data, 39);

        this.group = new THREE.Group();
        this.group.scale.set(1/4, 1/4, 1/4);
        this.group.position.set(-this.position.x, this.position.z, this.position.y);
        this.group.quaternion.set(QB, QC, QD, QA);

        this.rotation = {
            x: this.group.rotation.x,
            y: this.group.rotation.y,
            z: this.group.rotation.z
        };

        this.updateRotation();
        editor.scene.add(this.group);

        // add rigid body to object list tab
        let detailsElement = document.createElement("details");
        let summaryElement = document.createElement("summary");
        let textElement = document.createElement("span");

        textElement.textContent = "Body " + this.id;

        textElement.addEventListener("click", (e) => {
            e.preventDefault();
            editor.toggleSelect(SelectionType.RIGID_BODY, this.id);
        })

        summaryElement.appendChild(textElement);
        detailsElement.appendChild(summaryElement);
        object_list.appendChild(detailsElement);

        this.objectListElement = detailsElement;
    }

    delete() {
        while(this.childShapes.length>0) {
            let id = this.childShapes[this.childShapes.length-1];
            editor.childShapes[id].delete();
            this.childShapes.pop();
        }
        const statement = editor.db.prepare("DELETE FROM RigidBody WHERE id = ?;");
        statement.run([this.id]);

        editor.scene.remove(this.group);

        this.objectListElement.remove();
    }

    updateDatabase() {
        writeFloatToData(this.data, 0x2B, this.position.x);
        writeFloatToData(this.data, 0x2F, this.position.y);
        writeFloatToData(this.data, 0x33, this.position.z);

        // TODO save rotation data

        const statement = editor.db.prepare("UPDATE RigidBody SET data = ? WHERE id = ?;");
        statement.run([this.data, this.id]);
    }

    addChildShape(id) {
        this.childShapes.push(id);
    }

    removeChildShape(id) {
        this.childShapes = this.childShapes.filter(function (shapeID) {
            return shapeID != id;
        });
        if (this.childShapes.length == 0) this.delete();
    }

    updatePosition() {
        this.group.position.set(-this.position.x, this.position.z, this.position.y);
    }

    updateRotation() {
        this.group.rotation.set(0,0,0);

        const rotationX = this.rotation.x;
        const rotationY = this.rotation.y;
        const rotationZ = this.rotation.z;

        if (!(rotationX==0 && rotationY==0 && rotationZ==0)) {

            let axis = new THREE.Vector3(0, 1, 0);
            this.group.rotateOnWorldAxis(axis, -rotationX);

            axis = new THREE.Vector3(0, 0, 1);
            this.group.rotateOnWorldAxis(axis, rotationY);

            axis = new THREE.Vector3(1, 0, 0);
            this.group.rotateOnWorldAxis(axis, rotationZ+Math.PI);

        }
    }

    getProperties() {
        return [
            new Vector3ObjectProperty("Position", this.position, this.updatePosition.bind(this)),
            new Vector3ObjectProperty("Rotation", this.rotation, this.updateRotation.bind(this), function(val) {
                return val*Math.PI/180;
            })
        ];
    }
}
