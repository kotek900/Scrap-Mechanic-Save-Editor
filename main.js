import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

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

let selected;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

let mouseCanSelectObject = false;

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

window.addEventListener('resize', onWindowResize);

function onWindowResize() {
    camera.aspect = (window.innerWidth * 0.7 - 10) / (window.innerHeight - 70);
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth * 0.7 - 10, window.innerHeight - 70);
}

const loader = new GLTFLoader();

let unknownModel;

loader.load('unknown.glb', function(gltf) {

    unknownModel = gltf;

}, undefined, function(error) {

    console.error(error);

});

main_view.children[1].addEventListener('pointermove', onPointerMove);
main_view.children[1].addEventListener('pointerdown', onPointerDown);

main_view.children[1].onclick = function() {
    const intersects = raycaster.intersectObjects(scene.children);
    if (!mouseCanSelectObject) return;
    if (intersects.length == 0) return;
    if (intersects[0].object.ChildShapeID == undefined) return;

    selected = intersects[0];
    changeSelection();
}

function changeSelection() {
    info_selected.textContent = ChildShapes[selected.object.ChildShapeID].type + " ID: " + selected.object.ChildShapeID;
    selected_color_picker.value = "#" + ChildShapes[selected.object.ChildShapeID].color.toString(16)
        .padStart(6, '0');
    selected_UUID.value = ChildShapes[selected.object.ChildShapeID].UUID;

    input_position_x.value = ChildShapes[selected.object.ChildShapeID].position.x;
    input_position_y.value = ChildShapes[selected.object.ChildShapeID].position.y;
    input_position_z.value = ChildShapes[selected.object.ChildShapeID].position.z;
}

selected_color_picker.addEventListener('input', function(evt) {
    ChildShapes[selected.object.ChildShapeID].color = parseInt(selected_color_picker.value.slice(1), 16);
    ChildShapes[selected.object.ChildShapeID].createMesh();
});

input_position_x.addEventListener('input', function(evt) {
    ChildShapes[selected.object.ChildShapeID].position.x = Math.floor(input_position_x.value);
    ChildShapes[selected.object.ChildShapeID].createMesh();
});

input_position_y.addEventListener('input', function(evt) {
    ChildShapes[selected.object.ChildShapeID].position.y = Math.floor(input_position_y.value);
    ChildShapes[selected.object.ChildShapeID].createMesh();
});

input_position_z.addEventListener('input', function(evt) {
    ChildShapes[selected.object.ChildShapeID].position.z = Math.floor(input_position_z.value);
    ChildShapes[selected.object.ChildShapeID].createMesh();
});

function animate() {
    requestAnimationFrame(animate);
    controls.update();

    raycaster.setFromCamera(pointer, camera);

    renderer.render(scene, camera);
}

animate();

const SQL = await initSqlJs({
    locateFile: file => `https://sql.js.org/dist/${file}`
});

scene.background = new THREE.Color(0x7eafec);
camera.far = 20000;

function parseFloat(str) {
    var float = 0,
        sign, order, mantiss, exp,
        int = 0,
        multi = 1;
    if (/^0x/.exec(str)) {
        int = parseInt(str, 16);
    } else {
        for (var i = str.length - 1; i >= 0; i -= 1) {
            if (str.charCodeAt(i) > 255) {
                console.log('Wrong string parametr');
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

class ChildShape {
    createMesh() {

        if (this.mesh != undefined) {
            scene.remove(this.mesh);
            this.mesh.remove();
        }

        let geometry;

        const material = new THREE.MeshLambertMaterial({ color: this.color });

        if (this.type == "block") {
            geometry = new THREE.BoxGeometry(this.size.z, this.size.x, this.size.y);
            this.mesh = new THREE.Mesh(geometry, material);
        } else if (this.type == "part") {
            this.mesh = unknownModel.scene;
        }

        console.log(this.position.x);

        this.mesh.position.y = this.position.x + RigidBodies[this.bodyID].position.z * 4;
        this.mesh.position.z = this.position.y + RigidBodies[this.bodyID].position.y * 4;
        this.mesh.position.x = -(this.position.z + RigidBodies[this.bodyID].position.x * 4);

        if (this.type == "block") {
            this.mesh.position.y += this.size.x / 2;
            this.mesh.position.z += this.size.y / 2;
            this.mesh.position.x -= this.size.z / 2;
        }

        this.mesh.ChildShapeID = this.id;

        scene.add(this.mesh);

    }
    constructor(data) {
        this.data = data;
        this.id = data[0];
        this.bodyID = data[1];
        this.color = data[2][0x28] * 0x010000 + data[2][0x27] * 0x000100 + data[2][0x26] * 0x000001;

        this.UUID = "";

        this.UUID += data[2][0x1A].toString(16).padStart(2, '0');
        this.UUID += data[2][0x19].toString(16).padStart(2, '0');
        this.UUID += data[2][0x18].toString(16).padStart(2, '0');
        this.UUID += data[2][0x17].toString(16).padStart(2, '0');
        this.UUID += "-";
        this.UUID += data[2][0x16].toString(16).padStart(2, '0');
        this.UUID += data[2][0x15].toString(16).padStart(2, '0');
        this.UUID += "-";
        this.UUID += data[2][0x14].toString(16).padStart(2, '0');
        this.UUID += data[2][0x13].toString(16).padStart(2, '0');
        this.UUID += "-";
        this.UUID += data[2][0x12].toString(16).padStart(2, '0');
        this.UUID += data[2][0x11].toString(16).padStart(2, '0');
        this.UUID += "-";
        this.UUID += data[2][0x10].toString(16).padStart(2, '0');
        this.UUID += data[2][0x0F].toString(16).padStart(2, '0');
        this.UUID += data[2][0x0E].toString(16).padStart(2, '0');
        this.UUID += data[2][0x0D].toString(16).padStart(2, '0');
        this.UUID += data[2][0x0C].toString(16).padStart(2, '0');
        this.UUID += data[2][0x0B].toString(16).padStart(2, '0');

        let partType = data[2][1];
        if (partType == 0x1f) {
            this.type = "block";
            this.size = { x: data[2][0x2E], y: data[2][0x2C], z: data[2][0x2A] };
        } else if (partType == 0x20) {
            this.type = "part";
            this.rotation = data[2][0x29];
        }

        this.position = { x: data[2][0x23] * 256 + data[2][0x24], y: data[2][0x21] * 256 + data[2][0x22], z: data[2][0x1F] * 256 + data[2][0x20] }

        if (data[2][0x23] > 127) this.position.x -= 65536;
        if (data[2][0x21] > 127) this.position.y -= 65536;
        if (data[2][0x1F] > 127) this.position.z -= 65536;

        this.createMesh();
    }
}

class RigidBody {
    constructor(data) {
        this.data = data;
        this.id = data[0];
        this.worldID = data[1];

        let floatStringX = "0x";
        let floatStringY = "0x";
        let floatStringZ = "0x";
        floatStringX = floatStringX + data[2][0x2B].toString(16)
            .padStart(2, '0') + data[2][0x2C].toString(16)
            .padStart(2, '0') + data[2][0x2D].toString(16)
            .padStart(2, '0') + data[2][0x2E].toString(16)
            .padStart(2, '0');
        floatStringY = floatStringY + data[2][0x2F].toString(16)
            .padStart(2, '0') + data[2][0x30].toString(16)
            .padStart(2, '0') + data[2][0x31].toString(16)
            .padStart(2, '0') + data[2][0x32].toString(16)
            .padStart(2, '0');
        floatStringZ = floatStringZ + data[2][0x33].toString(16)
            .padStart(2, '0') + data[2][0x34].toString(16)
            .padStart(2, '0') + data[2][0x35].toString(16)
            .padStart(2, '0') + data[2][0x36].toString(16)
            .padStart(2, '0');

        this.position = { x: parseFloat(floatStringX), y: parseFloat(floatStringY), z: parseFloat(floatStringZ) }

    }
}


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
