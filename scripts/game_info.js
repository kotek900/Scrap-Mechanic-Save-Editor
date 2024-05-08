import { editor } from "editor";
import { readUUID } from "utils";

export class GameInfo {
    constructor(data) {
        this.saveGameVersion = data[0];
        this.flags = data[1];
        this.seed = data[2];
        this.gameTick = data[3];
        this.mods = data[4];
        this.uniqueIds = data[5];
        this.childShapeID = data[5][15] + (data[5][14]<<8) + (data[5][13]<<16) + (data[5][12]<<24);
        this.modList = Array((this.mods[0]<<24)+(this.mods[1]<<16)+(this.mods[2]<<8)+this.mods[3]);

        const infoMods = document.getElementById("info_mods");
        infoMods.textContent = this.modList.length;

        for (let i = 0; i < this.modList.length; i++) {
            let fileId = 0;
            for (let j = 0; j < 8; j++) {
                fileId <<= 8;
                fileId += this.mods[i*25+4+j];
            }

            this.modList[i] = {
                fileId: fileId,
                localId: readUUID(this.mods, i*25+27)
            };
            this.addModToTable(this.modList[i], i);
        }
    }

    addMod(fileId, localId) {
        const mod = {
            fileId: fileId,
            localId: localId
        };
        this.modList.push(mod);
        this.addModToTable(mod, this.modList.length-1);

        const infoMods = document.getElementById("info_mods");
        infoMods.textContent = this.modList.length;
    }

    addModToTable(mod, position) {
        const tableMods = document.getElementById("table_mods");
        const currentRow = tableMods.insertRow(position+1);
        const fileIdCell = currentRow.insertCell(0);
        const localIdCell = currentRow.insertCell(1);
        const buttonRemoveCell = currentRow.insertCell(2);

        var linkElement = document.createElement("a");
        linkElement.innerText = mod.fileId;
        linkElement.href = "https://steamcommunity.com/sharedfiles/filedetails/?id="+mod.fileId;
        linkElement.target = "_blank";
        linkElement.classList.add("link_alterantive_1");
        fileIdCell.appendChild(linkElement);

        localIdCell.textContent = mod.localId;

        var buttonElement = document.createElement("button");
        buttonElement.innerText = "🗙";
        buttonElement.classList.add("table_remove");
        buttonElement.addEventListener("click", () => {
            const modID = currentRow.rowIndex - 1;
            this.modList.splice(modID, 1);
            currentRow.remove();
            const infoMods = document.getElementById("info_mods");
            infoMods.textContent = this.modList.length;
        });

        buttonRemoveCell.appendChild(buttonElement);
    }

    advanceChildShapeID() {
        this.childShapeID++;
        this.uniqueIds[15] = this.childShapeID%256;
        this.uniqueIds[14] = (this.childShapeID>>8)%256;
        this.uniqueIds[13] = (this.childShapeID>>16)%256;
        this.uniqueIds[12] = (this.childShapeID>>24)%256;

        let statement = db.prepare("UPDATE Game SET uniqueIds = ?;");
        statement.run([this.uniqueIds]);
    }

    updateDatabase() {
        let statement = editor.db.prepare("UPDATE Game SET savegameversion = ?, seed = ?, gametick = ?;");
        statement.run([this.saveGameVersion, this.seed, this.gameTick]);

        let modData = new Uint8Array(this.modList.length*24+4);
    
        modData[3] = this.modList.length%256;
        modData[2] = (this.modList.length>>8)%256;
        modData[1] = (this.modList.length>>16)%256;
        modData[0] = (this.modList.length>>24)%256;

        for (let i = 0; i < this.modList.length; i++) {
            let thisFileId = this.modList[i].fileId;
            for (let j = 0; j < 8; j++) {
                modData[i*24+11-j] = thisFileId % 256;
                thisFileId >>= 8;
            }

            let k = 0;
            let uuidPosition = i*24+27;
            while (k < 36) {
                modData[uuidPosition--] = parseInt(this.modList[i].localId[k]+this.modList[i].localId[k+1], 16);
                k += (k==6||k==11||k==16||k==21) ? 3 : 2;
            }
        }

        statement = editor.db.prepare("UPDATE Game SET mods = ?;");
        statement.run([modData]);
        this.mods = modData;
    }
}
