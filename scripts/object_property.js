export class ObjectProperty {
    constructor(name, refValue) {
        this.name = name;
        this.refValue = refValue;
    }

    createView(parent) {
        // assert not reached
        console.assert(false);
    }
}

export class Vector3ObjectProperty extends ObjectProperty {
    constructor(name, refValue, changeCallback, modifier, min, max) {
        super(name, refValue);
        this.changeCallback = changeCallback;
        this.modifier = modifier;
        this.min = min;
        this.max = max;
    }

    createView(parent) {
        parent.append(this.name);

        const components = ["x", "y", "z"];
        for(const comp of components) {
            const div = document.createElement("div");
            div.append(comp+": ");
            const input = document.createElement("input");
            input.setAttribute("type", "number");
            input.value = this.refValue[comp];
            if(this.min)
                input.setAttribute("min", this.min);
            if(this.max)
                input.setAttribute("max", this.max);
            input.addEventListener("input", this.changeListener.bind(this));
            input.coord = comp;
            div.appendChild(input);
            parent.appendChild(div);
        }
    }

    changeListener(event) {
        this.refValue[event.target.coord] = this.modifier?this.modifier(event.target.value):event.target.value;
        this.changeCallback();
    }
}
