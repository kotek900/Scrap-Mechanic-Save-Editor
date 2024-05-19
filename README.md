# Scrap Mechanic Save Editor
An online editor for Scrap Mechanic save files.

## Use
Online version can be found at: https://kotek900.com/Scrap-Mechanic-Save-Editor/

Open a Scrap Mechanic save file (.db) with the button on the top left.
To save the file, click the "save" button on the right to download it.

## Game Info tab

The Game Info tab contains information about the save file.
You can change the seed, tick and the version of the save file.
Changing the version of the save file only changes the metadata, changing the save version value is not recommended.

## 3D view tab

In the 3D view tab you can see the Scrap Mechanic world in a 3D environment.
Rotate the camera with left click and move it around with right click.
Select objects with left click without dragging the mouse.
On the right you can see the propeties of the selected object, you can change the color, position, UUID and size of blocks. It's also possible to select the rigid body of blocks and delete objects. To create new blocks you need to select the rigid body and then click the create block button.

## Self hosting

To run the editor on your own computer put the files on a local http server, simply opening the index.html file in a web browser will not work.
For example you can use `python3 -m http.server` or any other server software, then connect to it in a web browser.

## Future versions

Work on the save editor is still in progress, you can contribute on [GitHub](https://github.com/kotek900/Scrap-Mechanic-Save-Editor/).
