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
        this.objectListElementClone = infoElement.cloneNode(true);

        if (childShapeA!=undefined) childShapeA.jointIdA.push(this.id);
        if (childShapeB!=undefined) childShapeB.jointIdB.push(this.id);

        setTimeout(function () {
            if (childShapeA!=undefined) childShapeA.updateHTML();
            if (childShapeB!=undefined) childShapeB.updateHTML();
        }, 0);
    }
}
