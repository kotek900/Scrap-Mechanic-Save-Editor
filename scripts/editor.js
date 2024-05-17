import * as THREE from 'three';

import { ChildShape, PartType } from "child_shape";
import { GameInfo } from "game_info";
import { RigidBody } from "rigid_body";

const SQL = await initSqlJs({
    locateFile: file => `https://sql.js.org/dist/${file}`
});

// Fake "enum"
export const SelectionType = {
    NONE: 0,
    GAME_INFO: 1,
    CHILD_SHAPE: 2,
    RIGID_BODY: 3
};

export let mainSelection;

function changeMainSelection(type, objectID) {
    let oldSelection = mainSelection;
    mainSelection = getObjectByID(type, objectID);

    if (mainSelection && mainSelection.objectListElement) {
        mainSelection.objectListElement.classList.add("selected_main");
    }

    if (oldSelection && oldSelection.objectListElement) {
        oldSelection.objectListElement.classList.remove("selected_main");
    }
}

function getObjectByID(type, objectID) {
    switch(type) {
    case SelectionType.CHILD_SHAPE:
        return editor.childShapes[objectID];
    case SelectionType.RIGID_BODY:
        return editor.rigidBodies[objectID];
    case SelectionType.NONE:
        return;
    }
    console.error("invalid type: " + type);
}


class Selection {
    constructor(type, objectID) {
        this.type = type;
        this.objectID = [objectID];
        changeMainSelection(type, objectID);
    }

    select(objectID) {
        changeMainSelection(this.type, objectID);
        if (this.objectID.includes(objectID)) return;
        this.objectID.unshift(objectID);
    }

    toggleSelect(objectID) {
        if (this.objectID.includes(objectID)) this.deselect(objectID);
        else editor.select(this.type, objectID, true);
    }

    deselect(objectID) {
        let object = getObjectByID(editor.selected.type, objectID);

        if (object && object.objectListElement) {
            object.objectListElement.classList.remove("selected");
        }

        if (this.type == SelectionType.CHILD_SHAPE &&
            this.objectID.includes(objectID) &&
            editor.childShapes[objectID].type==PartType.BLOCK) {
                resetColor(editor.childShapes[objectID]);
        }

        this.objectID = this.objectID.filter(function (id) {
            return id != objectID;
        });

        if (this.objectID.length == 0) {
            // clear the selection
            editor.deselect();
            return;
        }

        // reset the selection
        if (mainSelection.id == objectID) {
            editor.select(this.type, this.objectID[0], true);
        }
    }
}

function resetColor(block) {
    block.mesh.material.color = new THREE.Color(block.color);
}

class Editor {
    constructor() {
        this.selected = new Selection(SelectionType.NONE, 0);
        this.childShapes = [];
        this.rigidBodies = [];
        this.db = null;
        this.gameInfo = null;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x7eafec);

        // Save information
        this.gameVersion = 0;
        this.gameTick = 0;
        this.seed = 0;
    }

    afterSaveLoad(reader) {
        this.prepareScene();
        if(this.db)
            this.db.close();
        this.rigidBodies.length = 0;
        this.childShapes.length = 0;

        const byteView = new Uint8Array(reader.result);
        this.db = new SQL.Database(byteView);

        const gameData = this.db.exec("SELECT * FROM Game;")[0].values[0];
        this.gameVersion = gameData[0];
        this.gameTick = gameData[3];
        this.seed = gameData[2];
        this.gameInfo = new GameInfo(gameData);

        const rigidBodyData = this.db.exec("SELECT * FROM RigidBody;")[0].values;
        const childShapeData = this.db.exec("SELECT * FROM ChildShape;")[0].values;
        for (let i = 0; i < rigidBodyData.length; i++) {
            this.rigidBodies[rigidBodyData[i][0]] = new RigidBody(rigidBodyData[i]);
        }
        for (let i = 0; i < childShapeData.length; i++) {
            this.childShapes[childShapeData[i][0]] = new ChildShape(childShapeData[i]);
        }

        this.selected = new Selection(SelectionType.NONE, 0);
    }

    prepareScene() {
        // remove all objects from the scene
        while(this.scene.children.length > 0) {
            this.scene.remove(this.scene.children[0]);
        }

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        directionalLight.position.x = 2 / 3;
        directionalLight.position.z = 1 / 3;
        this.scene.add(directionalLight);

        const light = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(light);
    }

    updateSelectedDatabase() {
        switch(this.selected.type) {
        case SelectionType.GAME_INFO:
            this.gameInfo.updateDatabase();
            break;
        case SelectionType.CHILD_SHAPE:
            for (let i=0; i < this.selected.objectID.length; i++) this.childShapes[this.selected.objectID[i]].updateDatabase();
            break;
        case SelectionType.RIGID_BODY:
            for (let i=0; i < this.selected.objectID.length; i++) this.rigidBodies[this.selected.objectID[i]].updateDatabase();
        case SelectionType.NONE:
            break;
        default:
            // assert not reached
            console.assert(false);
            break;
        }
    }

    toggleSelect(type, objectID) {
        if (this.selected.type == type) this.selected.toggleSelect(objectID);
        else this.select(type, objectID);
    }

    select(type, objectID, keepSelection) {
        if (this.selected.type!=type) keepSelection = false;
        if (keepSelection!=true) this.deselect();

        if (keepSelection) this.selected.select(objectID);
        else this.selected = new Selection(type, objectID);

        if(type!=SelectionType.NONE && type!=SelectionType.GAME_INFO) {
            const inputBoxButtons = document.getElementById("input_box_buttons");
            inputBoxButtons.style.display = "block";
        }

        let object = getObjectByID(type, objectID);

        if (object && object.objectListElement) {
            object.objectListElement.classList.add("selected");
        }


        const infoSelected = document.getElementById("info_selected");
        switch(type) {
        case SelectionType.GAME_INFO:
            console.warn("GAME_INFO is no longer a valid selection type");

            infoSelected.textContent = "Game Info";
            break;
        case SelectionType.CHILD_SHAPE:
            const childShapeMenu = document.getElementById("ChildShape_menu");
            childShapeMenu.style.display = "block";

            infoSelected.textContent = this.childShapes[objectID].type + " ID: " + objectID;

            const buttonSelectBody = document.getElementById("button_select_body");
            buttonSelectBody.style.display = "inline-block";

            //size only applies to blocks and not parts
            const inputSize = document.getElementById("input_size");
            if (this.childShapes[objectID].type==PartType.BLOCK) {
                inputSize.style.display = "block";

                const inputSizeX = document.getElementById("input_size_x");
                input_size_x.value = this.childShapes[objectID].size.x;

                const inputSizeY = document.getElementById("input_size_y");
                inputSizeY.value = this.childShapes[objectID].size.y;

                const inputSizeZ = document.getElementById("input_size_z");
                inputSizeZ.value = this.childShapes[objectID].size.z;
            } else {
                inputSize.style.display = "none";
            }

            const selectedColorPicker = document.getElementById("selected_color_picker");
            selectedColorPicker.value = "#" + this.childShapes[objectID].color.toString(16).padStart(6, '0');

            const selectedUUID = document.getElementById("selected_UUID");
            selectedUUID.value = this.childShapes[objectID].uuid;

            const inputPositionX = document.getElementById("input_position_x");
            inputPositionX.value = this.childShapes[objectID].position.x;

            const inputPositionY = document.getElementById("input_position_y");
            inputPositionY.value = this.childShapes[objectID].position.y;

            const inputPositionZ = document.getElementById("input_position_z");
            inputPositionZ.value = this.childShapes[objectID].position.z;
            break;
        case SelectionType.RIGID_BODY:
            const rigidBodyMenu = document.getElementById("RigidBody_menu");
            rigidBodyMenu.style.display = "block";

            infoSelected.textContent = "Rigid body ID: " + objectID;

            const buttonCreateBlock = document.getElementById("button_create_block");
            buttonCreateBlock.style.display = "inline-block";

            const inputPositionXFloat = document.getElementById("input_position_x_float");
            inputPositionXFloat.value = this.rigidBodies[objectID].position.x;

            const inputPositionYFloat = document.getElementById("input_position_y_float");
            inputPositionYFloat.value = this.rigidBodies[objectID].position.y;

            const inputPositionZFloat = document.getElementById("input_position_z_float");
            inputPositionZFloat.value = this.rigidBodies[objectID].position.z;

            const inputRotationXFloat = document.getElementById("input_rotation_x_float");
            inputRotationXFloat.value = this.rigidBodies[objectID].rotation.x;

            const inputRotationYFloat = document.getElementById("input_rotation_y_float");
            inputRotationYFloat.value = this.rigidBodies[objectID].rotation.y;

            const inputRotationZFloat = document.getElementById("input_rotation_z_float");
            inputRotationZFloat.value = this.rigidBodies[objectID].rotation.z;
            break;
        default:
            // assert not reached
            console.assert(false);
            break;
        }
    }

    deselect() {
        for (let i=0; i < editor.selected.objectID.length; i++) {
            let object = getObjectByID(editor.selected.type, editor.selected.objectID[i]);

            if (object && object.objectListElement) {
                object.objectListElement.classList.remove("selected");
            }
        }


        const infoSelected = document.getElementById("info_selected");
        infoSelected.textContent = "none";

        const childShapeMenu = document.getElementById("ChildShape_menu");
        childShapeMenu.style.display = "none";

        const rigidBodyMenu = document.getElementById("RigidBody_menu");
        rigidBodyMenu.style.display = "none";

        const buttonSelectBody = document.getElementById("button_select_body");
        buttonSelectBody.style.display = "none";

        const buttonCreateBlock = document.getElementById("button_create_block");
        buttonCreateBlock.style.display = "none";

        const inputBoxButtons = document.getElementById("input_box_buttons");
        inputBoxButtons.style.display = "none";

        this.updateSelectedDatabase();

        if (this.selected.type==SelectionType.CHILD_SHAPE) {
            for (let i=0; i < editor.selected.objectID.length; i++) {
                if (this.childShapes[this.selected.objectID[i]].type!=PartType.BLOCK) continue;
                resetColor(this.childShapes[this.selected.objectID[i]]);
            }
        }

        this.selected = new Selection(SelectionType.NONE, 0);
    }
}

export const editor = new Editor();
