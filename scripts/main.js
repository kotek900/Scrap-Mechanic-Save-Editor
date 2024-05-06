// Import
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { ChildShape, PartType } from "child_shape";
import { editor, SelectionType } from "editor";

// Functions

function createChildShape(type, rigidBodyID) {
    let data = new Uint8Array(47);
    let childShapeID = Game.ChildShapeID;
    let statement = db.prepare("INSERT INTO ChildShape (id, bodyId) VALUES (?, ?);");
    statement.run([childShapeID, rigidBodyID]);

    Game.advanceChildShapeID();

    data[6] = childShapeID%256;
    data[5] = (childShapeID>>8)%256;
    data[4] = (childShapeID>>16)%256;
    data[3] = (childShapeID>>24);

    data[10] = rigidBodyID%256;
    data[9] = (rigidBodyID>>8)%256;
    data[8] = (rigidBodyID>>16)%256;
    data[7] = (rigidBodyID>>24);

    //rigid body ID is stored twice
    data[30] = data[10];
    data[29] = data[9];
    data[28] = data[8];
    data[27] = data[7];

    if (type=="block") {
        data[42] = 1;
        data[44] = 1;
        data[46] = 1;
    }

    data[0] = 1;
    data[2] = 1;
    data[37] = 255;

    if (type == "block") data[1] = 0x1f;
    if (type == "part") data[1] = 0x20;

    statement = db.prepare("UPDATE ChildShape SET data = ? WHERE id = ?;");
    statement.run([data, childShapeID]);

    let info = [];
    info[0] = childShapeID;
    info[1] = rigidBodyID;
    info[2] = data;

    ChildShapes[childShapeID] = new ChildShape(info);

    select("ChildShape", childShapeID);

    return childShapeID;
}

function onPointerMove(event) {
    // calculate pointer position in normalized device coordinates
    // (-1 to +1) for both components

    pointer.x = (event.clientX / (window.innerWidth * 0.7 - 10)) * 2 - 1;
    pointer.y = -((event.clientY - 70) / (window.innerHeight - 70)) * 2 + 1;

    mouseCanSelectObject = false;
}

function onPointerDown(event) {
    mouseCanSelectObject = true;
}

function onWindowResize() {
    camera.aspect = (window.innerWidth * 0.7 - 10) / (window.innerHeight - 70);
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth * 0.7 - 10, window.innerHeight - 70);
}

function checkInvalidUUID(UUID) {
    //regex for UUID
    let regex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/;
    return (UUID.match(regex)==null);
}


//update the save file
save_file_button.addEventListener('mouseenter', function(evt) {

    if (db==undefined) return;

    editor.updateSelectedDatabase();

    let data = db.export();
    let dataBlob = new Blob([data]);
    let url = URL.createObjectURL(dataBlob);
    save_file_link.href = url;
});

button_select_game_info.addEventListener('click', function(evt) {
    select("GameInfo", -1);
});

button_delete.addEventListener('click', function(evt) {
    deleteSelected()
});

button_select_body.addEventListener('click', function(evt) {
    if (selected.type=="ChildShape") {
        let bodyID = ChildShapes[selected.objectID].bodyID;
        select("RigidBody", bodyID);
    }
});

button_create_block.addEventListener('click', function(evt) {
    if (selected.type!="RigidBody") return;
    createChildShape("block", selected.objectID);
});


button_add_mod.addEventListener('click', function(evt) {
    if (selected.type!="GameInfo") return;
    if (checkInvalidUUID(input_mod_localId.value)) return;
    Game.addMod(input_mod_fileId.value, input_mod_localId.value);
});

selected_UUID.addEventListener('input', function(evt) {
    if (selected.type!="ChildShape") return;

    if (checkInvalidUUID(selected_UUID.value)) return;

    ChildShapes[selected.objectID].UUID = selected_UUID.value;
});


input_seed.addEventListener('input', function(evt) {
    if (selected.type!="GameInfo") return;
    Game.seed = input_seed.value;
    info_seed.textContent = "Seed: " + Game.seed;
});

input_tick.addEventListener('input', function(evt) {
    if (selected.type!="GameInfo") return;
    Game.gametick = input_tick.value;
    info_gametick.textContent = "Tick: " + Game.gametick;
});

input_version.addEventListener('input', function(evt) {
    if (selected.type!="GameInfo") return;
    Game.savegameversion = input_version.value;
    info_gameversion.textContent = "Version: " + Game.savegameversion;
});


selected_color_picker.addEventListener('input', function(evt) {
    if (selected.type!="ChildShape") return;
    ChildShapes[selected.objectID].color = parseInt(selected_color_picker.value.slice(1), 16);
    ChildShapes[selected.objectID].createMesh();
});

input_position_x.addEventListener('input', function(evt) {
    if (selected.type!="ChildShape") return;
    ChildShapes[selected.objectID].position.x = Math.floor(input_position_x.value);
    ChildShapes[selected.objectID].createMesh();
});

input_position_y.addEventListener('input', function(evt) {
    if (selected.type!="ChildShape") return;
    ChildShapes[selected.objectID].position.y = Math.floor(input_position_y.value);
    ChildShapes[selected.objectID].createMesh();
});

input_position_z.addEventListener('input', function(evt) {
    if (selected.type!="ChildShape") return;
    ChildShapes[selected.objectID].position.z = Math.floor(input_position_z.value);
    ChildShapes[selected.objectID].createMesh();
});

input_size_x.addEventListener('input', function(evt) {
    if (selected.type!="ChildShape") return;
    if (ChildShapes[selected.objectID].type!="block") return;
    ChildShapes[selected.objectID].size.x = Math.floor(input_size_x.value);
    ChildShapes[selected.objectID].createMesh();
});

input_size_y.addEventListener('input', function(evt) {
    if (selected.type!="ChildShape") return;
    if (ChildShapes[selected.objectID].type!="block") return;
    ChildShapes[selected.objectID].size.y = Math.floor(input_size_y.value);
    ChildShapes[selected.objectID].createMesh();
});

input_size_z.addEventListener('input', function(evt) {
    if (selected.type!="ChildShape") return;
    if (ChildShapes[selected.objectID].type!="block") return;
    ChildShapes[selected.objectID].size.z = Math.floor(input_size_z.value);
    ChildShapes[selected.objectID].createMesh();
});

input_position_x_float.addEventListener('input', function(evt) {
    if (selected.type!="RigidBody") return;
    RigidBodies[selected.objectID].position.x = input_position_x_float.value;
    RigidBodies[selected.objectID].updatePosition();
});

input_position_y_float.addEventListener('input', function(evt) {
    if (selected.type!="RigidBody") return;
    RigidBodies[selected.objectID].position.y = input_position_y_float.value;
    RigidBodies[selected.objectID].updatePosition();
});

input_position_z_float.addEventListener('input', function(evt) {
    if (selected.type!="RigidBody") return;
    RigidBodies[selected.objectID].position.z = input_position_z_float.value;
    RigidBodies[selected.objectID].updatePosition();
});

input_rotation_x_float.addEventListener('input', function(evt) {
    if (selected.type!="RigidBody") return;
    RigidBodies[selected.objectID].rotation.x = input_rotation_x_float.value*Math.PI/180;
    RigidBodies[selected.objectID].updateRotation();
});

input_rotation_y_float.addEventListener('input', function(evt) {
    if (selected.type!="RigidBody") return;
    RigidBodies[selected.objectID].rotation.y = input_rotation_y_float.value*Math.PI/180;
    RigidBodies[selected.objectID].updateRotation();
});

input_rotation_z_float.addEventListener('input', function(evt) {
    if (selected.type!="RigidBody") return;
    RigidBodies[selected.objectID].rotation.z = input_rotation_z_float.value*Math.PI/180;
    RigidBodies[selected.objectID].updateRotation();
});

function animate() {
    requestAnimationFrame(animate);
    controls.update();

    raycaster.setFromCamera(pointer, camera);

    let time = new Date();
    let selectionColor = new THREE.Color("white");
    selectionColor.lerpColors(new THREE.Color(0xded30b), new THREE.Color(0xf28e13), (Math.sin(time.getMilliseconds()/300)+1)/2);

    if (editor.selected.type==SelectionType.CHILD_SHAPE && editor.childShapes[selected.objectID].type==PartType.BLOCK) {
        selectionColor.lerp(new THREE.Color(ChildShapes[selected.objectID].color), 0.2);
        this.childShapes[selected.objectID].mesh.material.color = selectionColor;
    }

    renderer.render(scene, camera);
}


// Main code

function deleteSelected() {
    if (selected.type=="ChildShape") {
        let objectID = selected.objectID;
        deselect();
        ChildShapes[objectID].delete();
    } else if (selected.type=="RigidBody") {
        let objectID = selected.objectID;
        deselect();
        RigidBodies[objectID].delete();
    }
}

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, (window.innerWidth * 0.7 - 10) / (window.innerHeight - 70), 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth * 0.7 - 10, window.innerHeight - 70);
const canvas = main_view.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, canvas);

camera.position.z = 5;

editor.deselect();

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

let mouseCanSelectObject = false;

window.addEventListener('resize', onWindowResize);

const loader = new GLTFLoader();

let unknownModel;

loader.load(
    'unknown.glb', 
    function(gltf) {
        unknownModel = gltf;
    }, 
    undefined, 
    function(error) {
        console.error(error);
    }
);

main_view.children[1].addEventListener('pointermove', onPointerMove);
main_view.children[1].addEventListener('pointerdown', onPointerDown);

main_view.children[1].onclick = function() {
    const intersects = raycaster.intersectObjects(scene.children);
    if (!mouseCanSelectObject) return;
    if (intersects.length == 0) return;
    if (intersects[0].object.ChildShapeID == undefined) return;

    select("ChildShape", intersects[0].object.ChildShapeID);
}

animate();

scene.background = new THREE.Color(0x7eafec);
camera.far = 20000;


function copyElement(evt) {
    if (selected.type=="ChildShape") {
        let childs = [];

        let childShape = ChildShapes[selected.objectID];
        childs[0]={};
        childs[0].color = "#"+childShape.color.toString(16);
        childs[0].pos = childShape.position;
        childs[0].shapeId = childShape.UUID;
        if (childShape.type=="block") childs[0].bounds = childShape.size;

        event.clipboardData.setData("text/plain", JSON.stringify({childs: childs}));
        event.preventDefault();
    }
}

window.addEventListener("cut", function(evt) {
    if (document.activeElement!=document.body) return;
    copyElement(evt);
    if (selected.type=="ChildShape") deleteSelected();
});

window.addEventListener("copy", function(evt) {
    if (document.activeElement!=document.body) return;
    copyElement(evt);
});

window.addEventListener("paste", function(evt) {
    if (document.activeElement!=document.body) return;
    if (selected.type=="ChildShape"||selected.type=="RigidBody") {
        event.preventDefault();
        let bodyId = 0;
        let childData;
        try {
            let selectionString = event.clipboardData.getData("text");
            if (selected.type=="ChildShape") {
                bodyId = ChildShapes[selected.objectID].bodyID;
            } else {
                bodyId = selected.objectID;
            }

            childData = JSON.parse(selectionString).childs[0];
        } catch (e) {
            return;
        }

        let childShapeID = createChildShape("block", bodyId);
        ChildShapes[childShapeID].color = parseInt(childData.color.slice(1), 16)
        ChildShapes[childShapeID].position = childData.pos
        ChildShapes[childShapeID].UUID = childData.shapeId
        ChildShapes[childShapeID].size = childData.bounds

        ChildShapes[childShapeID].createMesh();

        select("ChildShape", childShapeID);
    }
});

open_file_button.onchange = () => {
    const f = open_file_button.files[0];
    const r = new FileReader();
    r.onload = function() {
        // remove all objects from the scene
        while (scene.children.length > 0) {
            scene.remove(scene.children[0]);
        }

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        directionalLight.position.x = 2 / 3;
        directionalLight.position.z = 1 / 3;
        scene.add(directionalLight);

        const light = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(light);

        editor.afterSaveLoad(r);

        const infoGameVersion = document.getElementById("info_gameversion");
        const infoSeed = document.getElementById("info_gameSeed");
        const infoGameTick = document.getElementById("info_gameTick");
        infoGameVersion.textContent = "Version: " + editor.gameVersion;
        infoSeed.textContent = "Seed: " + editor.seed;
        infoGameTick.textContent = "Tick: " + editor.gameTick;

        editor.deselect();
    }
    r.readAsArrayBuffer(f);
}
