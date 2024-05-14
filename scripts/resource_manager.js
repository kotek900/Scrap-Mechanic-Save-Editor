import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

class ResourceManager {
    constructor() {
        const loader = new GLTFLoader();
        const instance = this;
        loader.load(
            "unknown.glb",
            function(gltf) {
                instance.unknownModel = gltf;
            },
            undefined,
            function(error) {
                console.error(error);
            }
        );
    }
}

export const resourceManager = new ResourceManager();
