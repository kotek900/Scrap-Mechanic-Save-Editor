import { ChildShape } from "child_shape";
import { RigidBody } from "rigid_body";

const SQL = await initSqlJs({
    locateFile: file => `https://sql.js.org/dist/${file}`
});

class Selection {
    constructor(type, objectID) {
        this.type = type;
        this.objectID = objectID;
    }
}

class Editor {
    constructor() {
        this.selected = new Selection("none", 0);
        this.childShapes = [];
        this.rigidBodies = [];
        this.db = null;
        // Save information
        this.gameVersion = 0;
        this.gameTick = 0;
        this.seed = 0;
    }

    afterSaveLoad(reader) {
        if(this.db)
            this.db.free();
        this.rigidBodies.length = 0;
        this.childShapes.length = 0;

        const byteView = new Uint8Array(reader.result);
        this.db = new SQL.Database(byteView);

        const gameData = this.db.exec("SELECT * FROM Game;")[0].values[0];
        this.gameVersion = gameData[0];
        this.gameTick = gameData[3];
        this.seed = gameData[2];

        const childShapeData = db.exec("SELECT * FROM ChildShape;")[0].values;
        const rigidBodyData = db.exec("SELECT * FROM RigidBody;")[0].values;
        for (let i = 0; i < childShapeData.length; i++) {
            this.childShapes[childShapeData[i][0]] = new ChildShape(childShapeData[i]);
        }
        for (let i = 0; i < childShapeData.length; i++) {
            this.rigidBodies[rigidBodyData[i][0]] = new RigidBody(rigidBodyData[i]);
        }
    }
}

export const editor = new Editor();
