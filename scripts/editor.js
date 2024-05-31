import * as THREE from 'three';

import { ChildShape, PartType } from "child_shape";
import { GameInfo } from "game_info";
import { Joint } from "joint";
import { RigidBody } from "rigid_body";
import { SelectionPreview } from "selection_preview";

const SQL = await initSqlJs({
    locateFile: file => `https://sql.js.org/dist/${file}`
});

// Fake "enum"
export const SelectionType = {
    NONE: 0,
    GAME_INFO: 1,
    CHILD_SHAPE: 2,
    RIGID_BODY: 3,
    JOINT: 4
};

export let mainSelection;

function changeMainSelection(type, objectID) {
    let oldSelection = mainSelection;
    mainSelection = editor.getObjectByID(type, objectID);

    if (mainSelection && mainSelection.objectListElement) {
        mainSelection.objectListElement.classList.add("selected_main");
    }

    if (oldSelection && oldSelection.objectListElement) {
        oldSelection.objectListElement.classList.remove("selected_main");
    }
}

class Selection {
    constructor(type, objectID, updateMainSelection = true) {
        this.type = type;
        this.objectID = [objectID];

        if(updateMainSelection) {
            changeMainSelection(type, objectID);
            for (let i = 0; i < editor.selected.objectID.length; i++) {
                let object = editor.getObjectByID(editor.selected.type, editor.selected.objectID[i]);
                if (object && object.meshPreview) editor.selectionPreview.scene.remove(object.meshPreview);
            }

            editor.selectionPreview.addObject(this.type, objectID);
        }
    }

    select(objectID) {
        changeMainSelection(this.type, objectID);
        if (this.objectID.includes(objectID)) return;
        this.objectID.unshift(objectID);

        editor.selectionPreview.addObject(this.type, objectID);
    }

    toggleSelect(objectID) {
        if (this.objectID.includes(objectID)) this.deselect(objectID);
        else editor.select(this.type, objectID, true);
    }

    deselect(objectID) {
        let object = editor.getObjectByID(editor.selected.type, objectID);

        if (object.meshPreview) editor.selectionPreview.removeObject(object);

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
        this.selected = new Selection(SelectionType.NONE, 0, false);
        this.childShapes = [];
        this.rigidBodies = [];
        this.joints = [];
        this.db = null;
        this.gameInfo = null;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x7eafec);
        this.selectionPreview = new SelectionPreview();

        // Save information
        this.gameVersion = 0;
        this.gameTick = 0;
        this.seed = 0;
    }

    afterSaveLoad(reader) {
        this.prepareScene(this.scene);
        this.prepareScene(this.selectionPreview.scene);
        if(this.db)
            this.db.close();
        this.rigidBodies.length = 0;
        this.childShapes.length = 0;
        this.joints.length = 0;

        const byteView = new Uint8Array(reader.result);
        this.db = new SQL.Database(byteView);

        const gameData = this.db.exec("SELECT * FROM Game;")[0].values[0];
        this.gameVersion = gameData[0];

        if (this.gameVersion<27) {
            alert("Incompatible file version! Version: " + this.gameVersion + ". Compatible version: 27")
            return;
        }

        this.gameTick = gameData[3];
        this.seed = gameData[2];
        this.gameInfo = new GameInfo(gameData);

        const rigidBodyData = this.db.exec("SELECT * FROM RigidBody;")[0].values;
        const childShapeData = this.db.exec("SELECT * FROM ChildShape;")[0].values;
        const jointData = this.db.exec("SELECT id, childShapeIdA, childShapeIdB, data FROM Joint;")[0].values;
        for (let i = 0; i < rigidBodyData.length; i++) {
            this.rigidBodies[rigidBodyData[i][0]] = new RigidBody(rigidBodyData[i]);
        }
        for (let i = 0; i < childShapeData.length; i++) {
            this.childShapes[childShapeData[i][0]] = new ChildShape(childShapeData[i]);
        }
        for (let i = 0; i < jointData.length; i++) {
            this.joints[jointData[i][0]] = new Joint(jointData[i]);
        }

        this.selected = new Selection(SelectionType.NONE, 0);
    }

    prepareScene(scene) {
        // remove all objects from the scene
        while(scene.children.length > 0) {
            scene.remove(scene.children[0]);
        }

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        directionalLight.position.x = 2 / 3;
        directionalLight.position.z = 1 / 3;
        scene.add(directionalLight);

        const light = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(light);
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

        let object = this.getObjectByID(type, objectID);

        if (object && object.objectListElement) {
            object.objectListElement.classList.add("selected");
        }


        const infoSelected = document.getElementById("info_selected");
        const divPropertyView = document.getElementById("div_property_view");
        let properties;
        switch(type) {
        case SelectionType.GAME_INFO:
            console.warn("GAME_INFO is no longer a valid selection type");

            infoSelected.textContent = "Game Info";
            break;
        case SelectionType.CHILD_SHAPE:
            infoSelected.textContent = this.childShapes[objectID].type + " ID: " + objectID;

            const buttonSelectBody = document.getElementById("button_select_body");
            buttonSelectBody.style.display = "inline-block";

            properties = this.childShapes[objectID].getProperties();
            break;
        case SelectionType.RIGID_BODY:
            infoSelected.textContent = "Rigid body ID: " + objectID;

            const buttonCreateBlock = document.getElementById("button_create_block");
            buttonCreateBlock.style.display = "inline-block";

            properties = this.rigidBodies[objectID].getProperties();
            break;
        default:
            // assert not reached
            console.assert(false);
            break;
        }
        for(const property of properties) {
            const divInputBox = document.createElement("div");
            divInputBox.setAttribute("class", "input_box");
            property.createView(divInputBox);
            divPropertyView.appendChild(divInputBox);
        }
    }

    deselect() {
        for (let i=0; i < editor.selected.objectID.length; i++) {
            let object = this.getObjectByID(this.selected.type, this.selected.objectID[i]);

            if (object && object.objectListElement) {
                object.objectListElement.classList.remove("selected");
            }
        }

        const infoSelected = document.getElementById("info_selected");
        infoSelected.textContent = "none";

        const divPropertyView = document.getElementById("div_property_view");
        divPropertyView.innerHTML = "";

        const buttonSelectBody = document.getElementById("button_select_body");
        buttonSelectBody.style.display = "none";

        const buttonCreateBlock = document.getElementById("button_create_block");
        buttonCreateBlock.style.display = "none";

        this.updateSelectedDatabase();

        if (this.selected.type==SelectionType.CHILD_SHAPE) {
            for (let i=0; i < editor.selected.objectID.length; i++) {
                if (this.childShapes[this.selected.objectID[i]].type!=PartType.BLOCK) continue;
                resetColor(this.childShapes[this.selected.objectID[i]]);
            }
        }

        this.selected = new Selection(SelectionType.NONE, 0);
    }

    getObjectByID(type, objectID) {
        switch(type) {
        case SelectionType.CHILD_SHAPE:
            return this.childShapes[objectID];
        case SelectionType.RIGID_BODY:
            return this.rigidBodies[objectID];
        case SelectionType.NONE:
            return;
        }
        console.error("invalid type: " + type);
    }
}

export const editor = new Editor();
