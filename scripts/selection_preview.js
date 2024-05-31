import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { PartType } from "child_shape";
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

        this.objects = [];

        this.resetCorners();
        this.animate();
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    resetCorners() {
        // scene bounds in following order: bottom left front, top right back
        this.corners = [
            new THREE.Vector3(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER),
            new THREE.Vector3(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER),
        ];
    }

    updateCorners(object) {
        let width, height, depth;
        if(object.mesh) {
            // ChildShape
            switch(object.type) {
            case PartType.BLOCK:
                width = object.size.z;
                height = object.size.x;
                depth = object.size.y;
                break;
            case PartType.PART:
                // TODO
                width = 1;
                height = 1;
                depth = 1;
                break;
            default:
                // assert not reached
                console.assert(false);
            }
        }
        else if(object.group) {
            // RigidBody
            // TODO
            width = 0;
            height = 0;
            depth = 0;
        }

        if(object.meshPreview.position.x<this.corners[0].x)
            this.corners[0].x = object.meshPreview.position.x;
        if(object.meshPreview.position.y<this.corners[0].y)
            this.corners[0].y = object.meshPreview.position.y;
        if(object.meshPreview.position.z+depth>this.corners[0].z)
            this.corners[0].z = object.meshPreview.position.z+depth;

        if(object.meshPreview.position.x+width>this.corners[1].x)
            this.corners[1].x = object.meshPreview.position.x+width;
        if(object.meshPreview.position.y+height>this.corners[1].y)
            this.corners[1].y = object.meshPreview.position.y+height;
        if(object.meshPreview.position.z<this.corners[1].z)
            this.corners[1].z = object.meshPreview.position.z;
    }

    center() {
        const width = this.corners[1].x-this.corners[0].x;
        const height = this.corners[1].y-this.corners[0].y;
        const depth = this.corners[0].z-this.corners[1].z;
        this.camera.position.x = this.corners[0].x+width/2;
        this.camera.position.y = this.corners[0].y+height/2;
        this.camera.position.z = this.corners[0].z+depth+2;
        this.camera.lookAt(this.camera.position.x, this.camera.position.y, this.corners[0].z-depth/2);
    }

    addObject(type, objectID) {
        const object = editor.getObjectByID(type, objectID);
        if (object && (object.mesh || object.group)) {
            if (object.mesh)
                object.meshPreview = object.mesh.clone();
            if (object.group)
                object.meshPreview = object.group.clone();
            this.scene.add(object.meshPreview);
            this.objects.push(object);
            this.updateCorners(object);
            this.center();
        }
    }

    removeObject(object) {
        this.resetCorners();
        this.objects.splice(this.objects.indexOf(object), 1);
        for(const object of this.objects)
            this.updateCorners(object);
        this.scene.remove(object.meshPreview);
    }
}
