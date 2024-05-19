import * as THREE from 'three';

import { editor } from "editor";
import { readFloatFromData, writeFloatToData } from "utils";

export class Joint {
    constructor(data) {
        this.id = data[0];

        this.childShapeIdA = data[1];
        this.childShapeIdB = data[2];

        this.data = data[3];

        let childShapeA = editor.childShapes[this.childShapeIdA];
        let childShapeB = editor.childShapes[this.childShapeIdB];

        let infoElement = document.createElement("div");
        infoElement.textContent = "Joint " + this.id;

        this.objectListElement = infoElement;

        childShapeA.jointIdA.push(this.id);
        childShapeB.jointIdB.push(this.id);

        setTimeout(function () {
            childShapeA.updateHTML();
            childShapeB.updateHTML();
        }, 0);
    }
}
