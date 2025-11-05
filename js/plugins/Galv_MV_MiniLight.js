//-----------------------------------------------------------------------------
//  Galv's Mini Light
//-----------------------------------------------------------------------------
//  For: RPGMAKER MV
//  Galv_MV_MiniLight.js
//-----------------------------------------------------------------------------
//  2016-03-17 - Version 1.3 - fixed a bug with screen2d optimization
//  2016-03-17 - Version 1.2 - added 'light grow' command and optimization
//  2016-03-17 - Version 1.1 - added 'light' command (no add/sub) to change
//                           - light data of existing light
//  2016-03-17 - Version 1.0 - release
//-----------------------------------------------------------------------------
// Terms of use:
//  Free to use in any RPG Maker MV project
//  Free for commercial use
//
//=============================================================================

var Imported = Imported || {};
Imported.Galv_MiniLight = true;

var Galv = Galv || {};            // Galv's main object
Galv.MINILIGHT = Galv.MINILIGHT || {};      // Galv's stuff

//-----------------------------------------------------------------------------
/*:
 * @plugindesc (v.1.3) Creates a simple light layer that darkens the map and adds lightsources.
 * * @author Galv - galvs-scripts.com
 *
 * @help
 * Galv's Mini Light
 * ----------------------------------------------------------------------------
 * This plugin creates a dark layer above the map and light sources are added
 * to 'eat away' at the darkness.
 *
 * It is a very basic lighting plugin and does not include advanced features
 * such as shadows or coloured lights. It's designed to be simple and easy
 * to use light functionality.
 *
 * Events with the following comment in their "Comment" event command will act
 * as a light source:
 *
 * light X C
 *
 * X = radius of the light in pixels
 * C = opacity of the center of the light (0-255). This opacity fades to 0 at
 * the edges of the light.
 *
 * EXAMPLE: light 150 100
 *
 *
 * ----------------------------------------------------------------------------
 * PLUGIN COMMANDS
 * ----------------------------------------------------------------------------
 *
 * light set O C         // O = opacity (0-255), C = hex color code
 * // eg. light set 100 #888888
 * // This command sets the darkness layer opacity
 * // and color.
 *
 * light add I R O       // I = event ID (0 = player, -1 = this event)
 * // R = radius in pixels
 * // O = center opacity (0-255)
 * // This command adds a light to an event
 * // (or player)
 *
 * light addf I R O      // I = event ID (0 = player, -1 = this event)
 * // R = radius in pixels
 * // O = center opacity (0-255)
 * // This command adds a flickering light
 *
 * light sub I           // I = event ID (0 = player, -1 = this event)
 * // This command removes a light from an event
 * // (or player).
 *
 * light I R O           // I = event ID (0 = player, -1 = this event)
 * // R = radius in pixels
 * // O = center opacity (0-255)
 * // This changes an existing event's light to
 * // new settings.
 *
 * light grow I R O T F  // I = event ID (0 = player, -1 = this event)
 * // R = radius in pixels
 * // O = center opacity (0-255)
 * // T = target radius
 * // F = frames for growth
 * // This changes an existing event's light to
 * // new settings and grows to target radius.
 *
 * ----------------------------------------------------------------------------
 */
//-----------------------------------------------------------------------------

(function() {

// SCREEN XY
//-----------------------------------------------------------------------------
Game_Event.prototype.screenX = function() {
    var realX = this.scrolledX() * $gameMap.tileWidth();
	if (this._realX < this.x) {
		var dif = (this.x - this._realX) * $gameMap.tileWidth();
		realX -= dif;
	} else if (this._realX > this.x) {
		var dif = (this._realX - this.x) * $gameMap.tileWidth();
		realX += dif;
	}
    return Math.round(realX + $gameMap.tileWidth() / 2);
};

Game_Event.prototype.screenY = function() {
    var realY = this.scrolledY() * $gameMap.tileHeight();
	if (this._realY < this.y) {
		var dif = (this.y - this._realY) * $gameMap.tileHeight();
		realY -= dif;
	} else if (this._realY > this.y) {
		var dif = (this._realY - this.y) * $gameMap.tileHeight();
		realY += dif;
	}

    return Math.round(realY + $gameMap.tileHeight() - this.shiftY() - this.jumpHeight());
};


//-----------------------------------------------------------------------------
//  GAME INTERPRETER
//-----------------------------------------------------------------------------

Galv.MINILIGHT.Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
Game_Interpreter.prototype.pluginCommand = function(command, args) {
	Galv.MINILIGHT.Game_Interpreter_pluginCommand.call(this, command, args);
	if (command.toLowerCase() === 'light') {
		switch (args[0].toLowerCase()) {
			case 'set':
				$gameScreen._lightLayerData = [Number(args[1]),args[2]];
				break;
			case 'add':
				var eventId = args[1];
				if (eventId < 0) eventId = this._eventId;
				$gameSystem.addLight(eventId,Number(args[2]),Number(args[3]));
				break;
			case 'addf':
				var eventId = args[1];
				if (eventId < 0) eventId = this._eventId;
				$gameSystem.addLight(eventId,Number(args[2]),Number(args[3]),true);
				break;
			case 'sub':
				var eventId = args[1];
				if (eventId < 0) eventId = this._eventId;
				$gameSystem.removeLight(eventId);
				break;
			case 'grow':
				var eventId = args[1];
				if (eventId < 0) eventId = this._eventId;
				$gameSystem.changeLight(eventId,Number(args[2]),Number(args[3]),false,Number(args[4]),Number(args[5]));
				break;
			default:
				var eventId = args[0];
				if (eventId < 0) eventId = this._eventId;
				$gameSystem.changeLight(eventId,Number(args[1]),Number(args[2]));
				break;
		};
	};
};


//-----------------------------------------------------------------------------
//  GAME SYSTEM
//-----------------------------------------------------------------------------

Galv.MINILIGHT.Game_System_initialize = Game_System.prototype.initialize;
Game_System.prototype.initialize = function() {
	Galv.MINILIGHT.Game_System_initialize.call(this);
	this._lights = [];
};

Game_System.prototype.addLight = function(eventId,radius,opacity,flicker) {
	if (eventId == 0) {
		var obj = $gamePlayer;
	} else {
		var obj = $gameMap.event(eventId);
	};
	if (obj) this._lights.push({
		obj: obj,
		id: eventId,
		radius: radius,
		opacity: opacity,
		flicker: flicker,
		grow: 0,
		frames: 0
		});
};

Game_System.prototype.removeLight = function(eventId) {
	for (var i = 0; i < this._lights.length; i++) {
		if (this._lights[i].id == eventId) {
			this._lights.splice(i,1);
			return;
		};
	};
};

Game_System.prototype.changeLight = function(eventId,radius,opacity,flicker,grow,frames) {
	for (var i = 0; i < this._lights.length; i++) {
		if (this._lights[i].id == eventId) {
			this._lights[i].radius = radius;
			this._lights[i].opacity = opacity;
			this._lights[i].flicker = flicker;
			if (grow) {
				this._lights[i].grow = (grow - radius) / frames;
				this._lights[i].frames = frames;
			} else {
				this._lights[i].grow = 0;
				this._lights[i].frames = 0;
			};
			return;
		};
	};
};


//-----------------------------------------------------------------------------
//  GAME EVENT
//-----------------------------------------------------------------------------

Galv.MINILIGHT.Game_Event_setupPage = Game_Event.prototype.setupPage;
Game_Event.prototype.setupPage = function() {
	Galv.MINILIGHT.Game_Event_setupPage.call(this);
	this.setupMiniLight();
};

Game_Event.prototype.setupMiniLight = function() {
	$gameSystem.removeLight(this._eventId);
	var comments = this.comments();
	if (comments) {
		for (var i = 0; i < comments.length; i++) {
			if (comments[i].toLowerCase().contains("light ")) {
				varc = comments[i].split(" ");
				var flicker = varc[0].toLowerCase() == 'lightf' ? true : false;
				$gameSystem.addLight(this._eventId,Number(varc[1]),Number(varc[2]),flicker);
				return;
			}
		}
	}
};

Game_Event.prototype.comments = function() {
	if (!this.page() || !this.list()) return false;
	
	var comments = [];
	for (var i = 0; i < this.list().length; i++) {
		if (this.list()[i].code == 108 || this.list()[i].code == 408) {
			comments.push(this.list()[i].parameters[0]);
		}
	}
	return comments;
};


//-----------------------------------------------------------------------------
//  GAME SCREEN
//-----------------------------------------------------------------------------

Galv.MINILIGHT.Game_Screen_clear = Game_Screen.prototype.clear;
Game_Screen.prototype.clear = function() {
	Galv.MINILIGHT.Game_Screen_clear.call(this);
	this._lightLayerData = [0,"#000000"];
};

Galv.MINILIGHT.Game_Screen_update = Game_Screen.prototype.update;
Game_Screen.prototype.update = function(sceneActive) {
	Galv.MINILIGHT.Game_Screen_update.call(this,sceneActive);
	this.updateMiniLights();
};

Game_Screen.prototype.updateMiniLights = function() {
	for (var i = 0; i < $gameSystem._lights.length; i++) {
		if ($gameSystem._lights[i].frames > 0) {
			$gameSystem._lights[i].frames -= 1;
			$gameSystem._lights[i].radius += $gameSystem._lights[i].grow;
		}
	}
};


//-----------------------------------------------------------------------------
//  SPRITESET MAP
//-----------------------------------------------------------------------------

function Sprite_MiniLight() {
    this.initialize.apply(this, arguments);
}

Sprite_MiniLight.prototype = Object.create(Sprite.prototype);
Sprite_MiniLight.prototype.constructor = Sprite_MiniLight;

Sprite_MiniLight.prototype.initialize = function(light) {
    Sprite.prototype.initialize.call(this);
	this._light = light;
	this._radius = 0;
	this._opacity = 0;
	this.createBitmap();
	this.update();
};

Sprite_MiniLight.prototype.createBitmap = function() {
	this._radius = this._light.radius;
	this._opacity = this._light.opacity;
    this.bitmap = new Bitmap(this._radius * 2, this._radius * 2);
	var context = this.bitmap.context;
    var gradient = context.createRadialGradient(this._radius, this._radius, 0, this._radius, this._radius, this._radius);
    gradient.addColorStop(0, 'rgba(255, 255, 255, ' + this._opacity / 255 + ')');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

	context.fillStyle = gradient;
    context.fillRect(0, 0, this._radius * 2, this._radius * 2);
	this.anchor.x = 0.5;
	this.anchor.y = 0.5;
	this.blendMode = 1;
};

Sprite_MiniLight.prototype.update = function() {
    Sprite.prototype.update.call(this);
	if (this.lightChanged()) this.createBitmap();
	if (this._light.flicker) {
		this.opacity = 155 + Math.randomInt(100);
	}
    this.x = this._light.obj.screenX();
	this.y = this._light.obj.screenY();
};

Sprite_MiniLight.prototype.lightChanged = function() {
	return this._radius != this._light.radius || this._opacity != this._light.opacity
};


//-----------------------------------------------------------------------------
//  SPRITESET MAP
//-----------------------------------------------------------------------------

Galv.MINILIGHT.Spriteset_Map_createLowerLayer = Spriteset_Map.prototype.createLowerLayer;
Spriteset_Map.prototype.createLowerLayer = function() {
	Galv.MINILIGHT.Spriteset_Map_createLowerLayer.call(this);
	this.createLightLayer();
};

Spriteset_Map.prototype.createLightLayer = function() {
	this._lightContainer = new Sprite();
	this.addChild(this._lightContainer);
	
	this._lightLayer = new Sprite();
	this._lightLayer.bitmap = new Bitmap(Graphics.width,Graphics.height);
	this._lightLayer.opacity = $gameScreen._lightLayerData[0];
	this._lightLayer.bitmap.fillAll($gameScreen._lightLayerData[1]);
	this._lightContainer.addChild(this._lightLayer);
	
	this._lightSources = [];
	
	this.updateLightLayer();
};

Galv.MINILIGHT.Spriteset_Map_update = Spriteset_Map.prototype.update;
Spriteset_Map.prototype.update = function() {
	Galv.MINILIGHT.Spriteset_Map_update.call(this);
	this.updateLightLayer();
};


Spriteset_Map.prototype.updateLightLayer = function() {
	// If light opacity changed
	if (this._lightLayer.opacity != $gameScreen._lightLayerData[0] || this._lightLayerColor != $gameScreen._lightLayerData[1]) {
		this._lightLayer.opacity = $gameScreen._lightLayerData[0];
		this._lightLayerColor = $gameScreen._lightLayerData[1];
		this._lightLayer.bitmap.fillAll(this._lightLayerColor);
	};
	
	// If light sources changed
	if (this._lightSources.length != $gameSystem._lights.length) {
		this.refreshLightSources();
	}
	
	// Update light positions
	for (var i = 0; i < this._lightSources.length; i++) {
		this._lightSources[i].update();
	}
};

Spriteset_Map.prototype.refreshLightSources = function() {
	for (var i = 0; i < this._lightSources.length; i++) {
		this._lightContainer.removeChild(this._lightSources[i]);
	}
	this._lightSources = [];
	
	for (var i = 0; i < $gameSystem._lights.length; i++) {
		var sprite = new Sprite_MiniLight($gameSystem._lights[i]);
		this._lightSources.push(sprite);
		this._lightContainer.addChild(sprite);
	}
};

})();
