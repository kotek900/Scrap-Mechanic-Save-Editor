import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { editor } from "editor";

export class SelectionPreview {
    constructor() {
        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setSize(800, 600);

        this.camera = new THREE.PerspectiveCamera(75, 4/3, 0.1, 1000);
        this.camera.far = 20000;
        this.camera.position.z = 5;

        this.canvas = object_preview.appendChild(this.renderer.domElement);
        this.canvas.setAttribute("tabindex", "0");

        this.controls = new OrbitControls(this.camera, this.canvas);
        
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x7eafec);

        this.animate();
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    addObject(type, objectID) {
        const object = editor.getObjectByID(type, objectID);
        if (object && (object.mesh || object.group)) {
            if (object.mesh)
                object.meshPreview = object.mesh.clone();
            if (object.group)
                object.meshPreview = object.group.clone();
            this.scene.add(object.meshPreview);
        }
    }
}
