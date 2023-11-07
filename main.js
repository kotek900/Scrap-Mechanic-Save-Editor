// Import
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Classes

class selection {
    constructor(type, objectID) {
        this.type = type;
        this.objectID = objectID;
    }
}

class ChildShape {
    createMesh() {
        if (this.mesh != undefined) {
            RigidBodies[this.bodyID].group.remove(this.mesh);
            this.mesh.remove();
        }

        let geometry;

        const material = new THREE.MeshLambertMaterial({
            color: this.color
        });

        if (this.type == "block") {
            geometry = new THREE.BoxGeometry(this.size.z, this.size.x, this.size.y);
            this.mesh = new THREE.Mesh(geometry, material);
        } else if (this.type == "part") {
            this.mesh = unknownModel.scene.clone();
        }

        // Convert to a different coordinate system
        this.mesh.position.y = this.position.x;
        this.mesh.position.z = this.position.y;
        this.mesh.position.x = -this.position.z;

        if (this.type == "block") {
            this.mesh.position.y += this.size.x / 2;
            this.mesh.position.z += this.size.y / 2;
            this.mesh.position.x -= this.size.z / 2;
        }

        this.mesh.ChildShapeID = this.id;

        RigidBodies[this.bodyID].group.add(this.mesh);
    }

    updateDatabase() {
        //partType
        if (this.type == "block") this.data[1] = 0x1f;
        if (this.type == "part") this.data[1] = 0x20;

        //color
        let color = this.color
        let blue = color%256;
        color = (color-blue)/256;
        let green = color%256;
        color = (color-green)/256;
        let red = color;

        this.data[40] = red;
        this.data[39] = green;
        this.data[38] = blue;

        //UUID TODO

        //position
        let signX = 1;
        let signY = 1;
        let signZ = 1;
        let position = { x: this.position.x, y: this.position.y, z: this.position.z }; //this has to be this way because of JavaScript
        if (this.position.x<0) {
            signX = -1;
            position.x += 65536;
        }
        if (this.position.y<0) {
            signY = -1;
            position.y += 65536;
        }
        if (this.position.z<0) {
            signZ = -1;
            position.z += 65536;
        }

        this.data[36]=position.x%256;
        this.data[35]=(position.x-position.x%256)/256;

        this.data[34]=position.y%256;
        this.data[33]=(position.y-position.y%256)/256;

        this.data[32]=position.z%256;
        this.data[31]=(position.z-position.z%256)/256;

        //size/rotation TODO

        let statement = db.prepare("UPDATE ChildShape SET data = ? WHERE id = ?;");
        statement.run([this.data, this.id]);
    }

    delete() {
        RigidBodies[this.bodyID].group.remove(this.mesh);
        RigidBodies[this.bodyID].removeChildShape(this.id);
        this.mesh.remove();
        let statement = db.prepare("DELETE FROM ChildShape WHERE id = ?;");
        statement.run([this.id]);
    }
    
    constructor(data) {
        this.data = data[2];
        this.id = data[0];
        this.bodyID = data[1];
        this.color = (data[2][40] << 16) + (data[2][39] << 8) + data[2][38];

        RigidBodies[this.bodyID].addChildShape(this.id);

        this.UUID = "";
        for (let i = 0; i < 16; i++) {
            this.UUID += data[2][26-i].toString(16).padStart(2, '0');
            if (i === 3 || i === 5 || i === 7 || i === 9) {
                this.UUID += "-";
            }
        }
        
        let partType = data[2][1];
        if (partType == 0x1f) {
            this.type = "block";
            this.size = {
                x: data[2][0x2E], 
                y: data[2][0x2C], 
                z: data[2][0x2A] 
            };
        } else if (partType == 0x20) {
            this.type = "part";
            this.rotation = data[2][41];
        }

        // Why is this not just turning it into a short from the start?
        // This is cursed on so many levels
        this.position = {
            x: (data[2][35] << 8) + data[2][36], 
            y: (data[2][33] << 8) + data[2][34], 
            z: (data[2][31] << 8) + data[2][32] 
        }

        if (data[2][35] > 127) this.position.x -= 65536;
        if (data[2][33] > 127) this.position.y -= 65536;
        if (data[2][31] > 127) this.position.z -= 65536;

        this.createMesh();
    }
}

class RigidBody {
    updateDatabase() {
        let bytes;

        bytes = floatToBytes(this.position.x);

        this.data[0x2B] = bytes.getUint8(0);
        this.data[0x2C] = bytes.getUint8(1);
        this.data[0x2D] = bytes.getUint8(2);
        this.data[0x2E] = bytes.getUint8(3);

        bytes = floatToBytes(this.position.y);

        this.data[0x2F] = bytes.getUint8(0);
        this.data[0x30] = bytes.getUint8(1);
        this.data[0x31] = bytes.getUint8(2);
        this.data[0x32] = bytes.getUint8(3);

        bytes = floatToBytes(this.position.z);

        this.data[0x33] = bytes.getUint8(0);
        this.data[0x34] = bytes.getUint8(1);
        this.data[0x35] = bytes.getUint8(2);
        this.data[0x36] = bytes.getUint8(3);


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
        this.group.position.set(-this.position.x*4, this.position.z*4, this.position.y*4);
    }

    constructor(data) {
        this.data = data[2];
        this.id = data[0];
        this.worldID = data[1];

        // TODO: make this readable.
        let floatStringX = "0x";
        let floatStringY = "0x";
        let floatStringZ = "0x";
        floatStringX = floatStringX + 
            data[2][0x2B].toString(16).padStart(2, '0') + 
            data[2][0x2C].toString(16).padStart(2, '0') + 
            data[2][0x2D].toString(16).padStart(2, '0') + 
            data[2][0x2E].toString(16).padStart(2, '0');
        floatStringY = floatStringY + 
            data[2][0x2F].toString(16).padStart(2, '0') + 
            data[2][0x30].toString(16).padStart(2, '0') + 
            data[2][0x31].toString(16).padStart(2, '0') + 
            data[2][0x32].toString(16).padStart(2, '0');
        floatStringZ = floatStringZ + 
            data[2][0x33].toString(16).padStart(2, '0') + 
            data[2][0x34].toString(16).padStart(2, '0') + 
            data[2][0x35].toString(16).padStart(2, '0') + 
            data[2][0x36].toString(16).padStart(2, '0');

        this.position = {
            x: parseFloat(floatStringX), 
            y: parseFloat(floatStringY), 
            z: parseFloat(floatStringZ) 
        }


        let floatStringQA = "0x";
        let floatStringQB = "0x";
        let floatStringQC = "0x";
        let floatStringQD = "0x";
        floatStringQA = floatStringQA +
            data[2][27].toString(16).padStart(2, '0') +
            data[2][28].toString(16).padStart(2, '0') +
            data[2][29].toString(16).padStart(2, '0') +
            data[2][30].toString(16).padStart(2, '0');
        floatStringQB = floatStringQB +
            data[2][31].toString(16).padStart(2, '0') +
            data[2][32].toString(16).padStart(2, '0') +
            data[2][33].toString(16).padStart(2, '0') +
            data[2][34].toString(16).padStart(2, '0');
        floatStringQC = floatStringQC +
            data[2][35].toString(16).padStart(2, '0') +
            data[2][36].toString(16).padStart(2, '0') +
            data[2][37].toString(16).padStart(2, '0') +
            data[2][38].toString(16).padStart(2, '0');
        floatStringQD = floatStringQD +
            data[2][39].toString(16).padStart(2, '0') +
            data[2][40].toString(16).padStart(2, '0') +
            data[2][41].toString(16).padStart(2, '0') +
            data[2][42].toString(16).padStart(2, '0');

        let QA = parseFloat(floatStringQA);
        let QB = parseFloat(floatStringQB);
        let QC = parseFloat(floatStringQC);
        let QD = parseFloat(floatStringQD);

        this.group = new THREE.Group();

        this.group.position.set(-this.position.x*4, this.position.z*4, this.position.y*4);
        this.group.quaternion.set(QB, QC, QD, QA);

        let rotationX = this.group.rotation.x;
        let rotationY = this.group.rotation.y;
        let rotationZ = this.group.rotation.z;

        this.rotation = { x: rotationX, y: rotationY, z: rotationZ };

        this.group.rotation.set(0,0,0);

        if (!(rotationX==0&&rotationY==0&&rotationZ==0)) {

            let axis = new THREE.Vector3(0, 1, 0);
            this.group.rotateOnWorldAxis(axis, -rotationX);

            axis = new THREE.Vector3(0, 0, 1);
            this.group.rotateOnWorldAxis(axis, rotationY);

            axis = new THREE.Vector3(1, 0, 0);
            this.group.rotateOnWorldAxis(axis, rotationZ+Math.PI);

        }

        this.ChildShapes = [];

        scene.add(this.group);
    }
}

// Functions

function select(type, objectID) {
    deselect();

    selected = new selection(type, objectID);

    if (type!="none") {
        input_box_buttons.style.display = "block";
    }

    if (type=="ChildShape") {
        ChildShape_menu.style.display = "block";
        info_selected.textContent = ChildShapes[objectID].type + " ID: " + objectID;

        button_select_body.style.display = "inline-block";

        selected_color_picker.value = "#" + ChildShapes[objectID].color.toString(16).padStart(6, '0');
        selected_UUID.value = ChildShapes[objectID].UUID;

        input_position_x.value = ChildShapes[objectID].position.x;
        input_position_y.value = ChildShapes[objectID].position.y;
        input_position_z.value = ChildShapes[objectID].position.z;
    } else if (type=="RigidBody") {
        RigidBody_menu.style.display = "block";
        info_selected.textContent = "Rigid body ID: " + objectID;

        input_position_x_float.value = RigidBodies[objectID].position.x;
        input_position_y_float.value = RigidBodies[objectID].position.y;
        input_position_z_float.value = RigidBodies[objectID].position.z;
    }
}

function deselect() {
    info_selected.textContent = "none";

    ChildShape_menu.style.display = "none";
    RigidBody_menu.style.display = "none";

    button_select_body.style.display = "none";
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

function updateSelectedDatabase() {
    if (selected.type=="ChildShape") {
        ChildShapes[selected.objectID].updateDatabase();
    } else if (selected.type=="RigidBody") {
        RigidBodies[selected.objectID].updateDatabase();
    }
}

function floatToBytes(number) {
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setFloat32(0, number);
    return view;
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


//update the save file
save_file_button.addEventListener('mouseenter', function(evt) {

    if (db==undefined) return;

    updateSelectedDatabase();

    let data = db.export();
    let dataBlob = new Blob([data]);
    let url = URL.createObjectURL(dataBlob);
    save_file_link.href = url;
});

button_delete.addEventListener('click', function(evt) {
    if (selected.type=="ChildShape") {
        let objectID = selected.objectID;
        deselect();
        ChildShapes[objectID].delete();
    } else if (selected.type=="RigidBody") {
        let objectID = selected.objectID;
        deselect();
        RigidBodies[objectID].delete();
    }
});

button_select_body.addEventListener('click', function(evt) {
    if (selected.type=="ChildShape") {
        let bodyID = ChildShapes[selected.objectID].bodyID;
        select("RigidBody", bodyID);
    }
});

selected_UUID.addEventListener('input', function(evt) {
    if (selected.type!="ChildShape") return;

    //regex for UUID
    let regex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/;
    if (selected_UUID.value.match(regex)==null) return; //check if UUID is valid

    //set thew new UUID
    ChildShapes[selected.objectID].UUID = selected_UUID.value;
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

function parseFloat(str) {
    if (str=="0x00000000") return 0; //floating point error
    var float = 0,
        sign, order, mantiss, exp,
        int = 0,
        multi = 1;
    if (/^0x/.exec(str)) {
        int = parseInt(str, 16);
    } else {
        for (var i = str.length - 1; i >= 0; i -= 1) {
            if (str.charCodeAt(i) > 255) {
                console.log('Wrong string parameter');
                return false;
            }
            int += str.charCodeAt(i) * multi;
            multi *= 256;
        }
    }
    sign = (int >>> 31) ? -1 : 1;
    exp = (int >>> 23 & 0xff) - 127;
    let mantissa = ((int & 0x7fffff) + 0x800000)
        .toString(2);
    for (i = 0; i < mantissa.length; i += 1) {
        float += parseInt(mantissa[i]) ? Math.pow(2, exp) : 0;
        exp--;
    }
    return float * sign;
}

// Main code

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, (window.innerWidth * 0.7 - 10) / (window.innerHeight - 70), 0.1, 1000);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth * 0.7 - 10, window.innerHeight - 70);
main_view.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);

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

        let gameInfo = db.exec("SELECT * FROM Game;")[0].values[0];
        let gameversion = gameInfo[0];
        let seed = gameInfo[2];
        let gametick = gameInfo[3];

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
    }
    r.readAsArrayBuffer(f);
}
