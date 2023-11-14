# SM save editor
An online editor for Scrap Mechanic save files.

## Use
Online version can be found at: https://kotek900.com/SM-save-edit/

Open a Scrap Mechanic save file (.db) with the button on the top left.
Rotate the camera with left click and move it around with right click.

Select objects with left click without dragging the mouse.

On the right you can see the propeties of the selected object,
you can change the color, position, UUID and size of blocks.
It's also possible to select the rigid body of blocks and delete objects.
To create new blocks you need to select the rigid body and then click the create block button.

Finally to save the file, click the "save" button on the right to download the edited version.

## Self hosting

To run the editor on your own computer put the files on a local http server, simply opening the index.html file in a web browser will not work.
For example you can use `python3 -m http.server` or any other server software, then connect to it in a web browser.

## Future versions

Work on the save editor is still in progress, you can contribute on [GitHub](https://github.com/kotek900/SM-save-edit/).
