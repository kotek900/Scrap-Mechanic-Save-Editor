// Import
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { ChildShape, PartType } from "child_shape";
import { editor, SelectionType, mainSelection } from "editor";

// Functions

function createChildShape(type, rigidBodyID) {
    let data = new Uint8Array(47);
    let childShapeID = editor.gameInfo.childShapeID;
    let statement = editor.db.prepare("INSERT INTO ChildShape (id, bodyId) VALUES (?, ?);");
    statement.run([childShapeID, rigidBodyID]);

    editor.gameInfo.advanceChildShapeID();

    data[6] = childShapeID%256;
    data[5] = (childShapeID>>8)%256;
    data[4] = (childShapeID>>16)%256;
    data[3] = (childShapeID>>24);

    data[10] = rigidBodyID%256;
    data[9] = (rigidBodyID>>8)%256;
    data[8] = (rigidBodyID>>16)%256;
    data[7] = (rigidBodyID>>24);

    // rigid body ID is stored twice
    data[30] = data[10];
    data[29] = data[9];
    data[28] = data[8];
    data[27] = data[7];

    if (type==PartType.BLOCK) {
        data[42] = 1;
        data[44] = 1;
        data[46] = 1;
    }

    data[0] = 1;
    data[2] = 1;
    data[37] = 255;

    data[1] = type;

    statement = editor.db.prepare("UPDATE ChildShape SET data = ? WHERE id = ?;");
    statement.run([data, childShapeID]);

    let info = [];
    info[0] = childShapeID;
    info[1] = rigidBodyID;
    info[2] = data;

    editor.childShapes[childShapeID] = new ChildShape(info);

    return childShapeID;
}

function deleteSelected() {
    const objectID = editor.selected.objectID;
    switch(editor.selected.type) {
    case SelectionType.CHILD_SHAPE:
        for (let i = 0; i < objectID.length; i++) editor.childShapes[objectID[i]].delete();
        editor.deselect();
        break;
    case SelectionType.RIGID_BODY:
        for (let i = 0; i < objectID.length; i++) editor.rigidBodies[objectID[i]].delete();
        editor.deselect();
    default:
        break;
    }
}

function objectToJson(object, type) {
    switch(type) {
    case SelectionType.CHILD_SHAPE:
        let child = {};
        child.color = "#"+object.color.toString(16);
        child.pos = object.position;
        child.shapeId = object.uuid;
        if (object.type==PartType.BLOCK)
            child.bounds = object.size;

        return child;
    case SelectionType.RIGID_BODY:
        let childs = [];
        let body = {};
        for (let i = 0; i < object.childShapes.length; i++) {
            let childShape = editor.childShapes[object.childShapes[i]];

            childs[i] = objectToJson(childShape, SelectionType.CHILD_SHAPE);

            body = {childs: childs};
        }

        return body;
    }
    console.error("invalid object type: "+type);
}

function copyElement(event) {
    switch(editor.selected.type) {
    case SelectionType.CHILD_SHAPE:
        let childs = [];

        for (let i = 0; i < editor.selected.objectID.length; i++) {
            const childShape = editor.childShapes[editor.selected.objectID[i]];
            childs[i] = objectToJson(childShape, SelectionType.CHILD_SHAPE);
        }

        event.clipboardData.setData("text/plain", JSON.stringify({childs: childs}));
        event.preventDefault();
        break;
    case SelectionType.RIGID_BODY:
        let bodies = [];

        for (let i = 0; i < editor.selected.objectID.length; i++) {
            bodies[i] = objectToJson(editor.rigidBodies[editor.selected.objectID[i]], SelectionType.RIGID_BODY);
        }

        event.clipboardData.setData("text/plain", JSON.stringify({bodies: bodies, version: 4}));
        event.preventDefault();
        break;
    }
}

function checkInvalidUUID(uuid) {
    //regex for UUID
    let regex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/;
    return (uuid.match(regex)==null);
}

window.addEventListener('resize', function() {
    camera.aspect = (window.innerWidth * 0.7 - 10) / (window.innerHeight - 70);
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth * 0.7 - 10, window.innerHeight - 70);
});

window.addEventListener("cut", function(event) {
    if (document.activeElement!=document.body)
        return;
    copyElement(event);
    if (editor.selected.type==SelectionType.CHILD_SHAPE)
        deleteSelected();
});

window.addEventListener("copy", function(event) {
    if (document.activeElement!=document.body)
        return;
    copyElement(event);
});

window.addEventListener("paste", function(event) {
    if(document.activeElement!=document.body)
        return;

    if(editor.selected.type==SelectionType.CHILD_SHAPE || editor.selected.type==SelectionType.RIGID_BODY) {
        event.preventDefault();
        let bodyID = 0;
        let childData;
        try {
            const selectionString = event.clipboardData.getData("text");
            bodyID = editor.selected.type==SelectionType.CHILD_SHAPE ? mainSelection.bodyID : mainSelection.id;
            childData = JSON.parse(selectionString).childs;
        } catch (e) {
            return;
        }

        for (let i = 0; i < childData.length; i++) {
            const childShapeID = createChildShape(PartType.BLOCK, bodyID);
            editor.childShapes[childShapeID].color = parseInt(childData[i].color.slice(1), 16)
            editor.childShapes[childShapeID].position = childData[i].pos
            editor.childShapes[childShapeID].uuid = childData[i].shapeId
            editor.childShapes[childShapeID].size = childData[i].bounds

            editor.childShapes[childShapeID].createMesh();

            editor.select(SelectionType.CHILD_SHAPE, childShapeID, i!=0);
        }
    }
});

// update the save file
save_file_button.addEventListener('mouseenter', function(evt) {
    if(!editor.db)
        return;

    editor.updateSelectedDatabase();

    let data = editor.db.export();
    let dataBlob = new Blob([data]);
    let url = URL.createObjectURL(dataBlob);
    save_file_link.href = url;
});

button_delete.addEventListener('click', deleteSelected);

button_select_body.addEventListener('click', function(evt) {
    if(editor.selected.type==SelectionType.CHILD_SHAPE) {
        let bodyID = mainSelection.bodyID;
        editor.select(SelectionType.RIGID_BODY, bodyID);
    }
});

button_create_block.addEventListener('click', function(evt) {
    if(editor.selected.type!=SelectionType.RIGID_BODY)
        return;
    createChildShape(PartType.BLOCK, editor.selected.objectID);
});

button_add_mod.addEventListener('click', function(evt) {
    const inputModLocalID = document.getElementById("input_mod_localId");
    if (checkInvalidUUID(inputModLocalID.value))
        return;
    const inputModFileID = document.getElementById("input_mod_fileId");
    editor.gameInfo.addMod(inputModFileID.value, inputModLocalID.value);
    editor.gameInfo.updateDatabase();
});

selected_UUID.addEventListener('input', function(evt) {
    if(editor.selected.type!=SelectionType.CHILD_SHAPE || checkInvalidUUID(selected_UUID.value))
        return;
    mainSelection.uuid = selected_UUID.value;
});

input_seed.addEventListener('input', function(evt) {
    editor.gameInfo.seed = input_seed.value;
    editor.gameInfo.updateDatabase();
});

input_tick.addEventListener('input', function(evt) {
    editor.gameInfo.gameTick = input_tick.value;
    const infoGameTick = document.getElementById("info_gametick");
    editor.gameInfo.updateDatabase();
});

input_version.addEventListener('input', function(evt) {
    editor.gameInfo.saveGameVersion = input_version.value;
    const infoGameVersion = document.getElementById("info_gameversion");
    editor.gameInfo.updateDatabase();
});

selected_color_picker.addEventListener('input', function(evt) {
    if(editor.selected.type!=SelectionType.CHILD_SHAPE)
        return;
    mainSelection.color = parseInt(selected_color_picker.value.slice(1), 16);
    mainSelection.createMesh();
});

input_position_x.addEventListener('input', function(evt) {
    if(editor.selected.type!=SelectionType.CHILD_SHAPE)
        return;
    mainSelection.position.x = Math.floor(input_position_x.value);
    mainSelection.createMesh();
});

input_position_y.addEventListener('input', function(evt) {
    if(editor.selected.type!=SelectionType.CHILD_SHAPE)
        return;
    mainSelection.position.y = Math.floor(input_position_y.value);
    mainSelection.createMesh();
});

input_position_z.addEventListener('input', function(evt) {
    if(editor.selected.type!=SelectionType.CHILD_SHAPE)
        return;
    mainSelection.position.z = Math.floor(input_position_z.value);
    mainSelection.createMesh();
});

input_size_x.addEventListener('input', function(evt) {
    if(editor.selected.type!=SelectionType.CHILD_SHAPE || mainSelection.type!=PartType.BLOCK)
        return;
    mainSelection.size.x = Math.floor(input_size_x.value);
    mainSelection.createMesh();
});

input_size_y.addEventListener('input', function(evt) {
    if(editor.selected.type!=SelectionType.CHILD_SHAPE || mainSelection.type!=PartType.BLOCK)
        return;
    mainSelection.size.y = Math.floor(input_size_y.value);
    mainSelection.createMesh();
});

input_size_z.addEventListener('input', function(evt) {
    if(editor.selected.type!=SelectionType.CHILD_SHAPE || mainSelection.type!=PartType.BLOCK)
        return;
    mainSelection.size.z = Math.floor(input_size_z.value);
    mainSelection.createMesh();
});

input_position_x_float.addEventListener('input', function(evt) {
    if(editor.selected.type!=SelectionType.RIGID_BODY)
        return;
    editor.rigidBodies[editor.selected.objectID].position.x = input_position_x_float.value;
    editor.rigidBodies[editor.selected.objectID].updatePosition();
});

input_position_y_float.addEventListener('input', function(evt) {
    if(editor.selected.type!=SelectionType.RIGID_BODY)
        return;
    editor.rigidBodies[editor.selected.objectID].position.y = input_position_y_float.value;
    editor.rigidBodies[editor.selected.objectID].updatePosition();
});

input_position_z_float.addEventListener('input', function(evt) {
    if(editor.selected.type!=SelectionType.RIGID_BODY)
        return;
    editor.rigidBodies[editor.selected.objectID].position.z = input_position_z_float.value;
    editor.rigidBodies[editor.selected.objectID].updatePosition();
});

input_rotation_x_float.addEventListener('input', function(evt) {
    if(editor.selected.type!=SelectionType.RIGID_BODY)
        return;
    editor.rigidBodies[editor.selected.objectID].rotation.x = input_rotation_x_float.value*Math.PI/180;
    editor.rigidBodies[editor.selected.objectID].updateRotation();
});

input_rotation_y_float.addEventListener('input', function(evt) {
    if(editor.selected.type!=SelectionType.RIGID_BODY)
        return;
    editor.rigidBodies[editor.selected.objectID].rotation.y = input_rotation_y_float.value*Math.PI/180;
    editor.rigidBodies[editor.selected.objectID].updateRotation();
});

input_rotation_z_float.addEventListener('input', function(evt) {
    if(editor.selected.type!=SelectionType.RIGID_BODY)
        return;
    editor.rigidBodies[editor.selected.objectID].rotation.z = input_rotation_z_float.value*Math.PI/180;
    editor.rigidBodies[editor.selected.objectID].updateRotation();
});

function animate() {
    requestAnimationFrame(animate);
    controls.update();

    raycaster.setFromCamera(pointer, camera);

    if (editor.selected.type==SelectionType.CHILD_SHAPE) {
        const time = new Date();
        for (let i=0; i < editor.selected.objectID.length; i++) {
            const selectionColor = new THREE.Color("white");
            selectionColor.lerpColors(new THREE.Color(0xded30b), new THREE.Color(0xf28e13), (Math.sin(time.getMilliseconds()/300)+1)/2);
            let childShape = editor.childShapes[editor.selected.objectID[i]];
            if (childShape.type!=PartType.BLOCK) continue;
            selectionColor.lerp(new THREE.Color(childShape.color), 0.2);
            childShape.mesh.material.color = selectionColor;
        }
    }

    renderer.render(editor.scene, camera);
}

// Main code

const camera = new THREE.PerspectiveCamera(75, (window.innerWidth * 0.7 - 10) / (window.innerHeight - 70), 0.1, 1000);
camera.far = 20000;
camera.position.z = 5;

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth * 0.7 - 10, window.innerHeight - 70);

const canvas = main_view.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, canvas);

editor.deselect();

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

let mouseCanSelectObject = false;

main_view.children[1].addEventListener('pointermove', function() {
    // calculate pointer position in normalized device coordinates
    // (-1 to +1) for both components
    pointer.x = (event.clientX / (window.innerWidth * 0.7 - 10)) * 2 - 1;
    pointer.y = -((event.clientY - 70) / (window.innerHeight - 70)) * 2 + 1;
    mouseCanSelectObject = false;
});

main_view.children[1].addEventListener('pointerdown', function() {
    mouseCanSelectObject = true;
});

main_view.children[1].onclick = function() {
    const intersects = raycaster.intersectObjects(editor.scene.children);
    if (!mouseCanSelectObject || intersects.length == 0 || !intersects[0].object.hasOwnProperty("childShapeID"))
        return;

    if (window.event.shiftKey) editor.toggleSelect(SelectionType.CHILD_SHAPE, intersects[0].object.childShapeID);
    else editor.select(SelectionType.CHILD_SHAPE, intersects[0].object.childShapeID);
}

animate();

open_file_button.onchange = () => {
    const f = open_file_button.files[0];
    const r = new FileReader();
    r.onload = function() {
        editor.afterSaveLoad(r);

        editor.deselect();
    }
    r.readAsArrayBuffer(f);
}
