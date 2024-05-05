// Import
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { ChildShape } from "child_shape";
import { updateSelectedDatabase } from "utils";

// Classes

class selection {
    constructor(type, objectID) {
        this.type = type;
        this.objectID = objectID;
    }
}

class RigidBody {
    updateDatabase() {

        writeFloatToData(this.data, 0x2B, this.position.x);
        writeFloatToData(this.data, 0x2F, this.position.y);
        writeFloatToData(this.data, 0x33, this.position.z);


        // TODO save rotation data

        let statement = db.prepare("UPDATE RigidBody SET data = ? WHERE id = ?;");
        statement.run([this.data, this.id]);
    }

    addChildShape(id) {
        this.ChildShapes.push(id);
    }

    removeChildShape(id) {
        let index = this.ChildShapes.find((element) => element == id);
        this.ChildShapes.splice(index, 1);
    }

    delete() {
        while (this.ChildShapes.length>0) {
            let ID = this.ChildShapes[this.ChildShapes.length-1];
            ChildShapes[ID].delete();
            this.ChildShapes.pop();
        }
        let statement = db.prepare("DELETE FROM RigidBody WHERE id = ?;");
        statement.run([this.id]);
    }

    updatePosition() {
        this.group.position.set(-this.position.x, this.position.z, this.position.y);
    }

    updateRotation() {
        this.group.rotation.set(0,0,0);

        let rotationX = this.rotation.x;
        let rotationY = this.rotation.y;
        let rotationZ = this.rotation.z;

        if (!(rotationX==0&&rotationY==0&&rotationZ==0)) {

            let axis = new THREE.Vector3(0, 1, 0);
            this.group.rotateOnWorldAxis(axis, -rotationX);

            axis = new THREE.Vector3(0, 0, 1);
            this.group.rotateOnWorldAxis(axis, rotationY);

            axis = new THREE.Vector3(1, 0, 0);
            this.group.rotateOnWorldAxis(axis, rotationZ+Math.PI);

        }
    }

    constructor(data) {
        this.data = data[2];
        this.id = data[0];
        this.worldID = data[1];



        this.position = {
            x: readFloatFromData(data[2], 0x2B),
            y: readFloatFromData(data[2], 0x2F),
            z: readFloatFromData(data[2], 0x33)
        }

        let QA = readFloatFromData(data[2], 27);
        let QB = readFloatFromData(data[2], 31);
        let QC = readFloatFromData(data[2], 35);
        let QD = readFloatFromData(data[2], 39);

        this.group = new THREE.Group();

        this.group.scale.set(1/4, 1/4, 1/4);

        this.group.position.set(-this.position.x, this.position.z, this.position.y);
        this.group.quaternion.set(QB, QC, QD, QA);

        let rotationX = this.group.rotation.x;
        let rotationY = this.group.rotation.y;
        let rotationZ = this.group.rotation.z;

        this.rotation = { x: rotationX, y: rotationY, z: rotationZ };

        this.updateRotation();

        this.ChildShapes = [];

        scene.add(this.group);
    }
}

let Game;

class gameInfo {
    addMod(fileId, localId) {
        this.modList.push({ fileId: fileId, localId: localId });

        info_mods.textContent = this.modList.length;


        this.addModToTable({ fileId: fileId, localId: localId }, this.modList.length-1);
    }

    addModToTable(mod, position) {
        let currentRow = table_mods.insertRow(position+1);
        let fileId_Cell = currentRow.insertCell(0);
        let localId_Cell = currentRow.insertCell(1);
        let button_remove_Cell = currentRow.insertCell(2);


        var linkElement = document.createElement("a");
        linkElement.innerText = mod.fileId;
        linkElement.href = "https://steamcommunity.com/sharedfiles/filedetails/?id="+mod.fileId;
        linkElement.target = "_blank";
        linkElement.classList.add("link_alterantive_1");
        fileId_Cell.appendChild(linkElement);

        localId_Cell.textContent = mod.localId;

        var buttonElement = document.createElement("button");
        buttonElement.innerText = "🗙";
        buttonElement.classList.add("table_remove");
        button_remove_Cell.appendChild(buttonElement);

        buttonElement.addEventListener("click", () => {
            let modID = currentRow.rowIndex-1;
            this.modList.splice(modID,1);
            currentRow.remove();
            info_mods.textContent = this.modList.length;
        });
    }

    constructor(data) {
        this.savegameversion = data[0];
        this.flags = data[1];
        this.seed = data[2];
        this.gametick = data[3];
        this.mods = data[4];
        this.uniqueIds = data[5];

        console.log(data);
        this.ChildShapeID = data[5][15] + (data[5][14]<<8) + (data[5][13]<<16) + (data[5][12]<<24);

        this.modList = Array((this.mods[0]<<24)+(this.mods[1]<<16)+(this.mods[2]<<8)+this.mods[3]);

        info_mods.textContent = this.modList.length;

        for (let i = 0; i < this.modList.length; i++) {
            let fileId = 0;
            for (let j = 0; j < 8; j++) {
                fileId = fileId << 8;
                fileId+= this.mods[i*25+4+j];
            }

            let localId = readUUID(this.mods, i*25+27);

            this.modList[i] = { fileId: fileId, localId: localId };

            this.addModToTable(this.modList[i], i);
        }
    }

    advanceChildShapeID() {
        this.ChildShapeID++;
        this.uniqueIds[15] = this.ChildShapeID%256;
        this.uniqueIds[14] = (this.ChildShapeID>>8)%256;
        this.uniqueIds[13] = (this.ChildShapeID>>16)%256;
        this.uniqueIds[12] = (this.ChildShapeID>>24)%256;

        let statement = db.prepare("UPDATE Game SET uniqueIds = ?;");
        statement.run([this.uniqueIds]);
    }

    updateDatabase() {
        let statement = db.prepare("UPDATE Game SET savegameversion = ?, seed = ?, gametick = ?;");
        statement.run([this.savegameversion, this.seed, this.gametick]);

        let modData = new Uint8Array(this.modList.length*24+4);

        modData[3] = this.modList.length%256;
        modData[2] = (this.modList.length>>8)%256;
        modData[1] = (this.modList.length>>16)%256;
        modData[0] = (this.modList.length>>24)%256;


        for (let i = 0; i < this.modList.length; i++) {
            let thisFileId = this.modList[i].fileId;
            for (let j = 0; j < 8; j++) {
                modData[i*24+11-j] = thisFileId%256;
                thisFileId = thisFileId >> 8;
            }

            let k = 0;
            let UUID_position = i*24+27;
            while (k < 36) {
                modData[UUID_position--]=parseInt(this.modList[i].localId[k]+this.modList[i].localId[k+1], 16);
                if (k==6||k==11||k==16||k==21) k+=3;
                else k+=2;
            }
        }


        this.mods = modData;

        statement = db.prepare("UPDATE Game SET mods = ?;");
        statement.run([modData]);
    }
}

// Functions

function select(type, objectID) {
    deselect();

    selected = new selection(type, objectID);

    if (type!="none"&&type!="GameInfo") {
        input_box_buttons.style.display = "block";
    }

    if (type=="GameInfo") {
        GameInfo_menu.style.display = "block";
        info_selected.textContent = "Game Info";

        input_seed.value = Game.seed;
        input_tick.value = Game.gametick;
        input_version.value = Game.savegameversion;
    }
    if (type=="ChildShape") {
        ChildShape_menu.style.display = "block";
        info_selected.textContent = ChildShapes[objectID].type + " ID: " + objectID;

        button_select_body.style.display = "inline-block";

        //size only applies to blocks and not parts
        if (ChildShapes[objectID].type=="block") {
            input_size.style.display = "block";

            input_size_x.value = ChildShapes[objectID].size.x;
            input_size_y.value = ChildShapes[objectID].size.y;
            input_size_z.value = ChildShapes[objectID].size.z;
        } else {
            input_size.style.display = "none";
        }

        selected_color_picker.value = "#" + ChildShapes[objectID].color.toString(16).padStart(6, '0');
        selected_UUID.value = ChildShapes[objectID].UUID;

        input_position_x.value = ChildShapes[objectID].position.x;
        input_position_y.value = ChildShapes[objectID].position.y;
        input_position_z.value = ChildShapes[objectID].position.z;
    } else if (type=="RigidBody") {
        RigidBody_menu.style.display = "block";
        info_selected.textContent = "Rigid body ID: " + objectID;

        button_create_block.style.display = "inline-block";

        input_position_x_float.value = RigidBodies[objectID].position.x;
        input_position_y_float.value = RigidBodies[objectID].position.y;
        input_position_z_float.value = RigidBodies[objectID].position.z;

        input_rotation_x_float.value = RigidBodies[objectID].rotation.x;
        input_rotation_y_float.value = RigidBodies[objectID].rotation.y;
        input_rotation_z_float.value = RigidBodies[objectID].rotation.z;
    }
}

function deselect() {
    info_selected.textContent = "none";

    GameInfo_menu.style.display = "none";
    ChildShape_menu.style.display = "none";
    RigidBody_menu.style.display = "none";

    button_select_body.style.display = "none";
    button_create_block.style.display = "none";

    input_box_buttons.style.display = "none";

    updateSelectedDatabase();

    if (selected.type=="ChildShape") {
        if (ChildShapes[selected.objectID].type=="block") {
            //reset the color
            ChildShapes[selected.objectID].mesh.material.color = new THREE.Color(ChildShapes[selected.objectID].color);
        }
    }

    selected = new selection("none", 0);
}

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

    updateSelectedDatabase();

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

    if (selected.type=="ChildShape") {
        if (ChildShapes[selected.objectID].type=="block") {
            selectionColor.lerp(new THREE.Color(ChildShapes[selected.objectID].color), 0.2);
            ChildShapes[selected.objectID].mesh.material.color = selectionColor;
        }
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

let db;

let ChildShapes = [];
let RigidBodies = [];

let selected = new selection("none", 0);
deselect();

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

const SQL = await initSqlJs({
    locateFile: file => `https://sql.js.org/dist/${file}`
});

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

        const Uints = new Uint8Array(r.result);
        db = new SQL.Database(Uints);

        let gameData = db.exec("SELECT * FROM Game;")[0].values[0];
        let gameversion = gameData[0];
        let seed = gameData[2];
        let gametick = gameData[3];

        Game = new gameInfo(gameData);

        info_gameversion.textContent = "Version: " + gameversion;
        info_seed.textContent = "Seed: " + seed;
        info_gametick.textContent = "Tick: " + gametick;

        let ChildShapeData = db.exec("SELECT * FROM ChildShape;")[0].values;
        let RigidBodyData = db.exec("SELECT * FROM RigidBody;")[0].values;

        for (let i = 0; i < RigidBodyData.length; i++) {
            RigidBodies[RigidBodyData[i][0]] = new RigidBody(RigidBodyData[i]);
        }
        for (let i = 0; i < ChildShapeData.length; i++) {
            ChildShapes[ChildShapeData[i][0]] = new ChildShape(ChildShapeData[i]);
        }

        deselect();
    }
    r.readAsArrayBuffer(f);
}
