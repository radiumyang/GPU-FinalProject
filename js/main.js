var masterContainer = document.getElementById('visualization');

var overlay = document.getElementById('visualization');

var mapIndexedImage;
var mapOutlineImage;
var flagImage;

//	where in html to hold all our things
var glContainer = document.getElementById( 'glContainer' );

//	contains a list of country codes with their matching country names
var isoFile = 'country_iso3166.json';
var latlonFile = 'country_lat_lon.json'

var camera, scene, renderer, controls;

var pinsBase, pinsBaseMat;
var lookupCanvas
var lookupTexture;
var backTexture;
var worldCanvas;
var sphere;
var cube;
var rotating;
var rotating2;
var visualizationMesh;							

var mapUniforms;

//	contains the data loaded from the arms data file
//	contains a list of years, followed by trades within that year
//	properties for each "trade" is: e - exporter, i - importer, v - value (USD), wc - weapons code (see table)
var timeBins;

//	contains latlon data for each country
var latlonData;			    

//	contains above but organized as a mapped list via ['countryname'] = countryobject
//	each country object has data like center of country in 3d space, lat lon, country name, and country code
var countryData = new Object();		

//	contains a list of country code to country name for running lookups
var countryLookup;		    

var selectableYears = [];
var selectableCountries = [];			    

/*
	930100 – military weapons, and includes some light weapons and artillery as well as machine guns and assault rifles etc.  
	930190 – military firearms – eg assault rifles, machineguns (sub, light, heavy etc), combat shotguns, machine pistols etc
	930200 – pistols and revolvers
	930320 – Sporting shotguns (anything that isn’t rated as a military item).
	930330 – Sporting rifles (basically anything that isn’t fully automatic).
	930621 – shotgun shells
	930630 – small caliber ammo (anything below 14.5mm which isn’t fired from a shotgun.
*/

//	a list of weapon 'codes'
//	now they are just strings of categories
//	Category Name : Category Code
var weaponLookup = {
	'Military Weapons' 		: 'mil',
	'Civilian Weapons'		: 'civ',
	'Ammunition'			: 'ammo',
};

//	a list of the reverse for easy lookup
var reverseWeaponLookup = new Object();
for( var i in weaponLookup ){
	var name = i;
	var code = weaponLookup[i];
	reverseWeaponLookup[code] = name;
}	    	

//	A list of category colors
var categoryColors = {
	'mil' : 0xdd380c,
	'civ' : 0x3dba00,
	'ammo' : 0x154492,
}

var exportColor = 0xdd380c;
var importColor = 0x154492;

//	the currently selected country
var selectedCountry = null;
var previouslySelectedCountry = null;

//	contains info about what year, what countries, categories, etc that's being visualized
var selectionData;

//	when the app is idle this will be true
var idle = false;

//	for svg loading
//	deprecated, not using svg loading anymore
var assetList = [];

//	TODO
//	use underscore and ".after" to load these in order
//	don't look at me I'm ugly
function start( e ){	
	//	detect for webgl and reject everything else
	if ( ! Detector.webgl ) {
		Detector.addGetWebGLMessage();
	}
	else{
		//	ensure the map images are loaded first!!
		mapIndexedImage = new Image();
		mapIndexedImage.src = 'images/map_indexed.png';
		mapIndexedImage.onload = function() {
			mapOutlineImage = new Image();
			mapOutlineImage.src = 'images/map_outline.png';
			mapOutlineImage.onload = function(){
				flagImage = new Image();
				flagImage.src = 'images/Flag.png';
				flagImage.onload = function(){
					loadCountryCodes(
						function(){
							loadWorldPins(
								function(){										
									loadContentData(								
										function(){																	
											initScene();
											animate();		
										}
									);														
								}
							);
						}
					);
				};
			};			
		};		
	};
}			



var Selection = function(){
	this.selectedYear = '2010';
	this.selectedCountry = 'UNITED STATES';
	// this.showExports = true;
	// this.showImports = true;
	// this.importExportFilter = 'both';

	this.exportCategories = new Object();
	this.importCategories = new Object();
	for( var i in weaponLookup ){
		this.exportCategories[i] = true;
		this.importCategories[i] = true;
	}				

	this.getExportCategories = function(){
		var list = [];
		for( var i in this.exportCategories ){
			if( this.exportCategories[i] )
				list.push(i);
		}
		return list;
	}		

	this.getImportCategories = function(){
		var list = [];
		for( var i in this.importCategories ){
			if( this.importCategories[i] )
				list.push(i);
		}
		return list;
	}
};

//	-----------------------------------------------------------------------------
//	All the initialization stuff for THREE
function initScene() {

	//	-----------------------------------------------------------------------------
    //	Let's make a scene		
	scene = new THREE.Scene();
	scene.matrixAutoUpdate = false;		
	// scene.fog = new THREE.FogExp2( 0xBBBBBB, 0.00003 );		        		       

	scene.add( new THREE.AmbientLight( 0x505050 ) );				

	light1 = new THREE.SpotLight( 0xeeeeee, 3 );
	light1.position.x = 730; 
	light1.position.y = 520;
	light1.position.z = 626;
	light1.castShadow = true;
	scene.add( light1 );

	light2 = new THREE.PointLight( 0x222222, 14.8 );
	light2.position.x = -640;
	light2.position.y = -500;
	light2.position.z = -1000;
	scene.add( light2 );				

	rotating = new THREE.Object3D();
	scene.add(rotating);

	rotating2 = new THREE.Object3D();
	scene.add(rotating2);
	
	lookupCanvas = document.createElement('canvas');	
	lookupCanvas.width = 256;
	lookupCanvas.height = 1;
	
	lookupTexture = new THREE.Texture( lookupCanvas );
	lookupTexture.magFilter = THREE.NearestFilter;
	lookupTexture.minFilter = THREE.NearestFilter;
	lookupTexture.needsUpdate = true;

	var indexedMapTexture = new THREE.Texture( mapIndexedImage );
	indexedMapTexture.needsUpdate = true;
	indexedMapTexture.magFilter = THREE.NearestFilter;
	indexedMapTexture.minFilter = THREE.NearestFilter;

	var outlinedMapTexture = new THREE.Texture( mapOutlineImage );
	outlinedMapTexture.needsUpdate = true;
	// outlinedMapTexture.magFilter = THREE.NearestFilter;
	// outlinedMapTexture.minFilter = THREE.NearestFilter;
	
	var flagTexture = new THREE.Texture( flagImage );
	//THREE.ImageUtils.loadTexture( 'images/map_indexed.png' );
	flagTexture.needsUpdate = true;
	flagTexture.magFilter = THREE.NearestFilter;
	flagTexture.minFilter = THREE.NearestFilter;

	var uniforms = {
		'mapIndex': { type: 't', value: 0, texture: indexedMapTexture  },		
		'lookup': { type: 't', value: 1, texture: lookupTexture },
		'outline': { type: 't', value: 2, texture: outlinedMapTexture },
		'outlineLevel': {type: 'f', value: 1 },
	};
	mapUniforms = uniforms;

	var shaderMaterial = new THREE.ShaderMaterial( {

		uniforms: 		uniforms,
		// attributes:     attributes,
		vertexShader:   document.getElementById( 'globeVertexShader' ).textContent,
		fragmentShader: document.getElementById( 'globeFragmentShader' ).textContent,
		// sizeAttenuation: true,
		opacity: 0.5,
		blending: 		THREE.AdditiveBlending, //
		depthTest: 		true,
		depthWrite: 	false,
		transparent:	true,
	});
	
	var uniforms2 = {
		'flag': { type: 't', value: 3, texture: flagTexture  },
		'mapIndex': { type: 't', value: 0, texture: indexedMapTexture  },		
		'lookup': { type: 't', value: 1, texture: lookupTexture },
		'outline': { type: 't', value: 2, texture: outlinedMapTexture },
		'outlineLevel': {type: 'f', value: 1 },
	};
	var shaderMaterial2 = new THREE.ShaderMaterial( {

		uniforms: 		uniforms2,
		// attributes:     attributes,
		vertexShader:   document.getElementById( 'cubeVertexShader' ).textContent,
		fragmentShader: document.getElementById( 'cubeFragmentShader' ).textContent,
		// sizeAttenuation: true,
		
		/*opacity: 0.5,
		blending: 		THREE.AdditiveBlending,
		depthTest: 		true,
		depthWrite: 	false,
		transparent:	true,*/
	});
	
	var uniforms3 = {
		'flag': { type: 't', value: 3, texture: flagTexture  },
		'mapIndex': { type: 't', value: 0, texture: indexedMapTexture  },		
		'lookup': { type: 't', value: 1, texture: lookupTexture },
		'outline': { type: 't', value: 2, texture: outlinedMapTexture },
		'outlineLevel': {type: 'f', value: 1 },
	};
	var shaderMaterial3 = new THREE.ShaderMaterial( {

		uniforms: 		uniforms3,
		// attributes:     attributes,
		vertexShader:   document.getElementById( 'FlagVertexShader' ).textContent,
		fragmentShader: document.getElementById( 'FlagFragmentShader' ).textContent,
		// sizeAttenuation: true,
		
		opacity: 0.5,
		blending: 		THREE.MultiplyBlending,//MultiplyBlending
		depthTest: 		true,
		depthWrite: 	false,
		transparent:	true,
	});


						
	sphere = new THREE.Mesh( new THREE.SphereGeometry( 100, 40, 40 ), shaderMaterial );	//100 is radius, 40 is segments in width, 40 is segments in height
	sphere.doubleSided = true;
	sphere.rotation.x = Math.PI;				
	sphere.rotation.y = -Math.PI/2;
	sphere.rotation.z = Math.PI;
	sphere.id = "base";	
	rotating.add( sphere );	
	
	var extrudeSettings = {	amount: 20,  bevelEnabled: false, steps: 2 };
	var extrudePath = new THREE.Path();
	extrudePath.moveTo( 0, 0 );
	extrudePath.lineTo( 1.0, 1.0 );
	extrudePath.quadraticCurveTo( 8.0, 6.0, 16.0, 1.0 );
	extrudePath.quadraticCurveTo( 24.0, -4.0, 32.0, 1.0 );
	

	//extrudeSettings.extrudePath = extrudePath;

	
	
	/*var triangleShape = new THREE.Shape();
	triangleShape.moveTo(  8.0, 2.0 );
	triangleShape.lineTo(  4.0, 8.0 );
	triangleShape.lineTo( 12.0, 8.0 );
	triangleShape.lineTo(  8.0, 2.0 ); 
	var triangle3d = triangleShape.extrude( extrudeSettings );
	var trianglePoints = triangleShape.createPointsGeometry();
	var triangleSpacedPoints = triangleShape.createSpacedPointsGeometry();
	var mesh = THREE.SceneUtils.createMultiMaterialObject( triangle3d, [ new THREE.MeshLambertMaterial( { color: 0xffff00 } ), new THREE.MeshBasicMaterial( { color: 0x000000, wireframe: true, transparent: true } ) ] );
	var extrudeGeo = new THREE.Mesh( triangle3d, shaderMaterial2 );
	rotating.add( mesh );*/

	
	
	var americaPts = [];
	americaPts.push( new THREE.Vector2 ( 6.0, 2.0 ) );
	americaPts.push( new THREE.Vector2 ( 6.0, 4.6 ) );
	americaPts.push( new THREE.Vector2 ( 3.2, 3.9 ) );
	americaPts.push( new THREE.Vector2 ( 3.4, 6.8 ) );
	americaPts.push( new THREE.Vector2 ( 1.8, 10.6 ) );
	americaPts.push( new THREE.Vector2 ( 0.0, 14.3 ) );
	americaPts.push( new THREE.Vector2 ( 0.2, 16.3 ) );
	americaPts.push( new THREE.Vector2 ( -1.1, 18.2 ) );
	americaPts.push( new THREE.Vector2 ( -0.8, 21.1 ) );
	americaPts.push( new THREE.Vector2 ( 0.5, 23.9 ) );
	americaPts.push( new THREE.Vector2 ( -0.1, 26.2 ) );
	americaPts.push( new THREE.Vector2 ( 1.3, 28.9 ) );
	americaPts.push( new THREE.Vector2 ( 1.5, 30.3 ) );
	americaPts.push( new THREE.Vector2 ( 3.0, 31.5 ) );
	americaPts.push( new THREE.Vector2 ( 5.6, 34.4 ) );
	americaPts.push( new THREE.Vector2 ( 5.8, 35.9 ) );
	americaPts.push( new THREE.Vector2 ( 9.0, 36.1 ) );
	americaPts.push( new THREE.Vector2 ( 3.0, 31.5 ) );
	americaPts.push( new THREE.Vector2 ( 12.2, 38.5 ) );
	americaPts.push( new THREE.Vector2 ( 16.7, 39.9 ) );
	americaPts.push( new THREE.Vector2 ( 21.7, 40.1 ) );
	americaPts.push( new THREE.Vector2 ( 27.1, 45.9 ) );
	americaPts.push( new THREE.Vector2 ( 28.2, 44.3 ) );
	americaPts.push( new THREE.Vector2 ( 30.0, 44.6 ) );
	americaPts.push( new THREE.Vector2 ( 33.7, 51.8 ) );
	americaPts.push( new THREE.Vector2 ( 37.4, 52.5 ) );
	americaPts.push( new THREE.Vector2 ( 37.1, 49.1 ) );
	americaPts.push( new THREE.Vector2 ( 40.4, 46.3 ) );
	americaPts.push( new THREE.Vector2 ( 45.4, 45.4 ) );
	americaPts.push( new THREE.Vector2 ( 48.8, 45.8 ) );
	americaPts.push( new THREE.Vector2 ( 48.8, 43.8 ) );
	americaPts.push( new THREE.Vector2 ( 56.0, 43.4 ) );
	americaPts.push( new THREE.Vector2 ( 57.1, 44.5 ) );
	americaPts.push( new THREE.Vector2 ( 58.9, 43.4 ) );
	americaPts.push( new THREE.Vector2 ( 61.7, 46.2 ) );
	americaPts.push( new THREE.Vector2 ( 63.8, 50.3 ) );
	americaPts.push( new THREE.Vector2 ( 66.2, 51.8 ) );
	americaPts.push( new THREE.Vector2 ( 66.7, 48.4 ) );
	americaPts.push( new THREE.Vector2 ( 63.0, 42.1 ) );
	americaPts.push( new THREE.Vector2 ( 63.6, 38.1 ) );
	americaPts.push( new THREE.Vector2 ( 69.4, 33.0 ) );
	americaPts.push( new THREE.Vector2 ( 70.8, 30.8 ) );
	americaPts.push( new THREE.Vector2 ( 69.7, 25.4 ) );
	americaPts.push( new THREE.Vector2 ( 71.4, 20.7 ) );
	americaPts.push( new THREE.Vector2 ( 75.2, 18.3 ) );
	americaPts.push( new THREE.Vector2 ( 74.4, 14.5 ) );
	americaPts.push( new THREE.Vector2 ( 78.1, 11.1 ) );
	americaPts.push( new THREE.Vector2 ( 75.9, 6.5 ) );
	americaPts.push( new THREE.Vector2 ( 73.9, 7.0 ) );
	americaPts.push( new THREE.Vector2 ( 72.4, 12.1 ) );
	americaPts.push( new THREE.Vector2 ( 67.7, 13.5 ) );
	americaPts.push( new THREE.Vector2 ( 66.5, 16.5 ) );
	americaPts.push( new THREE.Vector2 ( 62.8, 16.9 ) );
	americaPts.push( new THREE.Vector2 ( 58.1, 21.7 ) );
	americaPts.push( new THREE.Vector2 ( 58.4, 18.2 ) );
	americaPts.push( new THREE.Vector2 ( 56.1, 16.9 ) );
	americaPts.push( new THREE.Vector2 ( 56.0, 14.0 ) );
	americaPts.push( new THREE.Vector2 ( 53.6, 16.2 ) );
	americaPts.push( new THREE.Vector2 ( 53.1, 19.9 ) );
	americaPts.push( new THREE.Vector2 ( 51.9, 21.9 ) );
	americaPts.push( new THREE.Vector2 ( 50.3, 19.7 ) );
	americaPts.push( new THREE.Vector2 ( 50.8, 14.4 ) );
	americaPts.push( new THREE.Vector2 ( 54.6, 12.4 ) );
	americaPts.push( new THREE.Vector2 ( 52.5, 11.5 ) );
	americaPts.push( new THREE.Vector2 ( 48.1, 12.4 ) );
	americaPts.push( new THREE.Vector2 ( 45.1, 12.3 ) );
	americaPts.push( new THREE.Vector2 ( 47.0, 9.8 ) );
	americaPts.push( new THREE.Vector2 ( 37.1, 7.8 ) );
	americaPts.push( new THREE.Vector2 ( 29.4, 7.2 ) );
	americaPts.push( new THREE.Vector2 ( 21.8, 6.4 ) );
	americaPts.push( new THREE.Vector2 ( 13.6, 4.9 ) );
	americaPts.push( new THREE.Vector2 ( 6.0, 2.0 ) );
	for(var i = 0; i < americaPts.length; ++i){
		americaPts[i] = new THREE.Vector2 (americaPts[i].x - 40, 30 - americaPts[i].y);
	}
	
	
	var americanShape = new THREE.Shape( americaPts );
	var american3d = new THREE.ExtrudeGeometry( americanShape, { amount: 20, bevelEnabled: false} );
	var americanPoints = americanShape.createPointsGeometry();
	var mesh = THREE.SceneUtils.createMultiMaterialObject( american3d, [ new THREE.MeshLambertMaterial( { color: 0xffff00 } ), new THREE.MeshBasicMaterial( { color: 0x000000, wireframe: true, transparent: true } ) ] );
	var extrudeGeo = new THREE.Mesh( american3d, shaderMaterial2 );
	rotating2.add( extrudeGeo );
	

	var virtuslSphere = new THREE.Mesh( new THREE.SphereGeometry( 50, 40, 40 ), shaderMaterial3 );	//100 is radius, 40 is segments in width, 40 is segments in height
	virtuslSphere.doubleSided = true;
	virtuslSphere.rotation.x = Math.PI;				
	virtuslSphere.rotation.y = -Math.PI/2;
	virtuslSphere.rotation.z = Math.PI;
	virtuslSphere.id = "base";	
	rotating2.add( virtuslSphere );	
	
	/*var extrudePath = new THREE.Path();
	extrudePath.moveTo( 0, 0 );
	extrudePath.lineTo( 1.0, 1.0 );
	extrudePath.quadraticCurveTo( 8.0, 6.0, 16.0, 1.0 );
	extrudePath.quadraticCurveTo( 24.0, -4.0, 32.0, 1.0 );

	extrudeSettings.extrudePath = extrudePath;
	extrudeSettings.bevelEnabled = false;*/
	
	
	/*var california3d = new THREE.ExtrudeGeometry( californiaShape, { amount: 20} );
	var mesh = THREE.SceneUtils.createMultiMaterialObject( california3d, [ new THREE.MeshLambertMaterial( { color: 0xffff00 } ), new THREE.MeshBasicMaterial( { color: 0x000000, wireframe: true, transparent: true } ) ] );
	var extrudeGeo = new THREE.Mesh( california3d, shaderMaterial2 );
	rotating.add( mesh );*/
	
	
	
	
	/*var geometry = new THREE.CylinderGeometry( 50, 50, 20, 32 );
	var material = new THREE.MeshBasicMaterial( {color: 0xffff00} );
	var cylinder = new THREE.Mesh( geometry, shaderMaterial2 );
	rotating.add( cylinder );*/

	/*
	var linesGeo = new THREE.Geometry();
	linesGeo.vertices.push(
		new THREE.Vector3( 0, 0, 0 ),
		new THREE.Vector3( 0, 100, 0 ),
		new THREE.Vector3( 100, 100, 0 ),
		new THREE.Vector3( 100, 0, 0 )
	);
	var splineOutline = new THREE.Line( linesGeo, new THREE.LineBasicMaterial( {color: 0xff1100, linewidth: 10}));
	
	var linesGeo2 = new THREE.Geometry();
	linesGeo2.vertices.push(
		new THREE.Vector3( -10, 0, 0 ),
		new THREE.Vector3( -10, 100, 0 ),
		new THREE.Vector3( -110, 100, 0 ),
		new THREE.Vector3( -110, 0, 0 )
	);
	var splineOutline2 = new THREE.Line( linesGeo2, new THREE.LineBasicMaterial( {color: 0xff1100, linewidth: 10}));
	
	var test = new THREE.Geometry();
	THREE.GeometryUtils.merge(test, linesGeo);
	THREE.GeometryUtils.merge(test, linesGeo2);
	var splineOutline3 = new THREE.Line( test, new THREE.LineBasicMaterial( {color: 0xff1100, linewidth: 10}), THREE.LinePieces);
	
	rotating.add( splineOutline3 );*/
	
	
	
	//var face = new THREE.Face3();
	
	/*cube = new THREE.Mesh( new THREE.CubeGeometry( 150, 150, 150 ), shaderMaterial2 );
	//cube.rotation.x = Math.PI/6;
	//cube.translateX = 1000;
	cube.translateY = 100;
	rotating.add( cube );	*/

	/////////////////////////
	/*var start = new THREE.Vector3(-100,0,0);
	var end = new THREE.Vector3(100,1,0);
	var mid = start.clone().lerpSelf(end, 0.5);	
	var distanceBetweenCountryCenter = start.clone().subSelf(end.clone()).length();
	var distanceHalf = distanceBetweenCountryCenter * 0.5;
	var midLength = mid.length()
	mid.normalize();
	mid.multiplyScalar( midLength + distanceBetweenCountryCenter * 0.7 );	
	
	var normal = (new THREE.Vector3()).sub(end,start);
	normal.normalize();
	


	var startAnchor = start;
	var midStartAnchor = mid.clone().addSelf( normal.clone().multiplyScalar( -distanceHalf ) );					
	var midEndAnchor = mid.clone().addSelf( normal.clone().multiplyScalar( distanceHalf ) );
	var splineCurveA = new THREE.CubicBezierCurve3( start, startAnchor, midStartAnchor, mid);	
	var points = splineCurveA.getPoints( 10 );
	
	var curveDir = (new THREE.Vector3()).sub(points[1], points[0]);
	var tangent = normal.clone().crossSelf(curveDir.clone());
	tangent.normalize();
	var spiralRadius = 5;
	for(var i = 0; i < points.length-1; ++i){
		var eachCurveDir = (new THREE.Vector3()).sub(points[i+1], points[i]);
		var segmentDis = eachCurveDir.length();
		eachCurveDir.normalize();
		var lat = eachCurveDir.clone().crossSelf(tangent.clone());
		
		for(var j = 0; j < 12; ++j){
			var pTan = tangent.clone().multiplyScalar(spiralRadius * Math.cos(2 * Math.PI / 12 * j));
			var pLat = lat.clone().multiplyScalar(spiralRadius * Math.sin(2 * Math.PI / 12 * j));
			var pCur = eachCurveDir.clone().multiplyScalar(segmentDis / 12 * j);
			var p = pTan.clone().addSelf(pLat).clone().addSelf(pCur);
			var a = 0;
		}
	}*/

	////////////////////////
	
	
	
	
	for( var i in timeBins ){					
		var bin = timeBins[i].data;
		for( var s in bin ){
			var set = bin[s];

			var exporterName = set.e.toUpperCase();
			var importerName = set.i.toUpperCase();

			//	let's track a list of actual countries listed in this data set
			//	this is actually really slow... consider re-doing this with a map
			if( $.inArray(exporterName, selectableCountries) < 0 )
				selectableCountries.push( exporterName );

			if( $.inArray(importerName, selectableCountries) < 0 )
				selectableCountries.push( importerName );
		}
	}

	console.log( selectableCountries );
	
	// load geo data (country lat lons in this case)
	console.time('loadGeoData');
	loadGeoData( latlonData );				
	console.timeEnd('loadGeoData');				

	console.time('buildDataVizGeometries');
	var vizilines = buildDataVizGeometries(timeBins);
	console.timeEnd('buildDataVizGeometries');

	visualizationMesh = new THREE.Object3D();
	rotating.add(visualizationMesh);	

	buildGUI();

	selectVisualization( timeBins, '2010', ['UNITED STATES'], ['Military Weapons','Civilian Weapons', 'Ammunition'], ['Military Weapons','Civilian Weapons', 'Ammunition'] );					



    //	-----------------------------------------------------------------------------
    //	Setup our renderer
	renderer = new THREE.WebGLRenderer({antialias:false});
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.autoClear = false;
	
	renderer.sortObjects = false;		
	renderer.generateMipmaps = false;					

	glContainer.appendChild( renderer.domElement );									


    //	-----------------------------------------------------------------------------
    //	Event listeners
	document.addEventListener( 'mousemove', onDocumentMouseMove, true );
	document.addEventListener( 'windowResize', onDocumentResize, false );

	//masterContainer.addEventListener( 'mousedown', onDocumentMouseDown, true );	
	//masterContainer.addEventListener( 'mouseup', onDocumentMouseUp, false );	
	document.addEventListener( 'mousedown', onDocumentMouseDown, true );	
	document.addEventListener( 'mouseup', onDocumentMouseUp, false );	
	
	masterContainer.addEventListener( 'click', onClick, true );	
	masterContainer.addEventListener( 'mousewheel', onMouseWheel, false );
	
	//	firefox	
	masterContainer.addEventListener( 'DOMMouseScroll', function(e){
		    var evt=window.event || e; //equalize event object
    		onMouseWheel(evt);
	}, false );

	document.addEventListener( 'keydown', onKeyDown, false);												    			    	

    //	-----------------------------------------------------------------------------
    //	Setup our camera
    camera = new THREE.PerspectiveCamera( 12, window.innerWidth / window.innerHeight, 1, 20000 ); 		        
	camera.position.z = 1400;
	camera.position.y = 0;
	camera.lookAt(scene.width/2, scene.height/2);	
	scene.add( camera );	  

	var windowResize = THREEx.WindowResize(renderer, camera)		
}
	

function animate() {	

	if( rotateTargetX !== undefined && rotateTargetY !== undefined ){

		rotateVX += (rotateTargetX - rotateX) * 0.012;
		rotateVY += (rotateTargetY - rotateY) * 0.012;
	

		if( Math.abs(rotateTargetX - rotateX) < 0.1 && Math.abs(rotateTargetY - rotateY) < 0.1 ){
			rotateTargetX = undefined;
			rotateTargetY = undefined;
		}
	}
	
	rotateX += rotateVX;
	rotateY += rotateVY;

	//rotateY = wrap( rotateY, -Math.PI, Math.PI );

	rotateVX *= 0.98;
	rotateVY *= 0.98;

	if(dragging || rotateTargetX !== undefined ){
		rotateVX *= 0.6;
		rotateVY *= 0.6;
	}	     

	rotateY += controllers.spin * 0.01;

	//	constrain the pivot up/down to the poles
	//	force a bit of bounce back action when hitting the poles
	if(rotateX < -rotateXMax){
		rotateX = -rotateXMax;
		rotateVX *= -0.95;
	}
	if(rotateX > rotateXMax){
		rotateX = rotateXMax;
		rotateVX *= -0.95;
	}		    			    		   

	TWEEN.update();		

	rotating.rotation.x = rotateX;
	rotating.rotation.y = rotateY;	

	rotating2.rotation.x = rotateX;
	rotating2.rotation.y = rotateY;	
	
    render();	
    		        		       
    requestAnimationFrame( animate );	


	/*THREE.SceneUtils.traverseHierarchy( rotating, 
		function(mesh) {
			if (mesh.update !== undefined) {
				mesh.update();
			} 
		}
	);	*/

	/*for( var i in markers ){
		var marker = markers[i];
		marker.update();
	}	*/	

}

function render() {	
	renderer.clear();		    					
    renderer.render( scene, camera );				
}		   

function findCode(countryName){
	countryName = countryName.toUpperCase();
	for( var i in countryLookup ){
		if( countryLookup[i] === countryName )
			return i;
	}
	return 'not found';
}

//	ordered lookup list for country color index
//	used for GLSL to find which country needs to be highlighted
var countryColorMap = {'PE':1,
'BF':2,'FR':3,'LY':4,'BY':5,'PK':6,'ID':7,'YE':8,'MG':9,'BO':10,'CI':11,'DZ':12,'CH':13,'CM':14,'MK':15,'BW':16,'UA':17,
'KE':18,'TW':19,'JO':20,'MX':21,'AE':22,'BZ':23,'BR':24,'SL':25,'ML':26,'CD':27,'IT':28,'SO':29,'AF':30,'BD':31,'DO':32,'GW':33,
'GH':34,'AT':35,'SE':36,'TR':37,'UG':38,'MZ':39,'JP':40,'NZ':41,'CU':42,'VE':43,'PT':44,'CO':45,'MR':46,'AO':47,'DE':48,'SD':49,
'TH':50,'AU':51,'PG':52,'IQ':53,'HR':54,'GL':55,'NE':56,'DK':57,'LV':58,'RO':59,'ZM':60,'IR':61,'MM':62,'ET':63,'GT':64,'SR':65,
'EH':66,'CZ':67,'TD':68,'AL':69,'FI':70,'SY':71,'KG':72,'SB':73,'OM':74,'PA':75,'AR':76,'GB':77,'CR':78,'PY':79,'GN':80,'IE':81,
'NG':82,'TN':83,'PL':84,'NA':85,'ZA':86,'EG':87,'TZ':88,'GE':89,'SA':90,'VN':91,'RU':92,'HT':93,'BA':94,'IN':95,'CN':96,'CA':97,
'SV':98,'GY':99,'BE':100,'GQ':101,'LS':102,'BG':103,'BI':104,'DJ':105,'AZ':106,'MY':107,'PH':108,'UY':109,'CG':110,'RS':111,'ME':112,'EE':113,
'RW':114,'AM':115,'SN':116,'TG':117,'ES':118,'GA':119,'HU':120,'MW':121,'TJ':122,'KH':123,'KR':124,'HN':125,'IS':126,'NI':127,'CL':128,'MA':129,
'LR':130,'NL':131,'CF':132,'SK':133,'LT':134,'ZW':135,'LK':136,'IL':137,'LA':138,'KP':139,'GR':140,'TM':141,'EC':142,'BJ':143,'SI':144,'NO':145,
'MD':146,'LB':147,'NP':148,'ER':149,'US':150,'KZ':151,'AQ':152,'SZ':153,'UZ':154,'MN':155,'BT':156,'NC':157,'FJ':158,'KW':159,'TL':160,'BS':161,
'VU':162,'FK':163,'GM':164,'QA':165,'JM':166,'CY':167,'PR':168,'PS':169,'BN':170,'TT':171,'CV':172,'PF':173,'WS':174,'LU':175,'KM':176,'MU':177,
'FO':178,'ST':179,'AN':180,'DM':181,'TO':182,'KI':183,'FM':184,'BH':185,'AD':186,'MP':187,'PW':188,'SC':189,'AG':190,'BB':191,'TC':192,'VC':193,
'LC':194,'YT':195,'VI':196,'GD':197,'MT':198,'MV':199,'KY':200,'KN':201,'MS':202,'BL':203,'NU':204,'PM':205,'CK':206,'WF':207,'AS':208,'MH':209,
'AW':210,'LI':211,'VG':212,'SH':213,'JE':214,'AI':215,'MF_1_':216,'GG':217,'SM':218,'BM':219,'TV':220,'NR':221,'GI':222,'PN':223,'MC':224,'VA':225,
'IM':226,'GU':227,'SG':228};

function highlightCountry( countries ){	
	var countryCodes = [];
	for( var i in countries ){
		var code = findCode(countries[i]);
		countryCodes.push(code);
	}

	var ctx = lookupCanvas.getContext('2d');	
	ctx.clearRect(0,0,256,1);

	//	color index 0 is the ocean, leave it something neutral
	
	//	this fixes a bug where the fill for ocean was being applied during pick
	//	all non-countries were being pointed to 10 - bolivia
	//	the fact that it didn't select was because bolivia shows up as an invalid country due to country name mismatch
	//	...
	var pickMask = countries.length == 0 ? 0 : 1;
	var oceanFill = 10 * pickMask;
	ctx.fillStyle = 'rgb(' + oceanFill + ',' + oceanFill + ',' + oceanFill +')';
	ctx.fillRect( 0, 0, 1, 1 );

	// for( var i = 0; i<255; i++ ){
	// 	var fillCSS = 'rgb(' + i + ',' + 0 + ',' + i + ')';
	// 	ctx.fillStyle = fillCSS;
	// 	ctx.fillRect( i, 0, 1, 1 );
	// }

	var selectedCountryCode = selectedCountry.countryCode;
	
	for( var i in countryCodes ){
		var countryCode = countryCodes[i];
		var colorIndex = countryColorMap[ countryCode ];

		var mapColor = countryData[countries[i]].mapColor;
		// var fillCSS = '#ff0000';
		var fillCSS = '#333333';
		if( countryCode === selectedCountryCode )
			fillCSS = '#eeeeee'
		// if( mapColor !== undefined ){
		// 	var k = map( mapColor, 0, 200000000, 0, 255 );
		// 	k = Math.floor( constrain( k, 0, 255 ) );
		// 	fillCSS = 'rgb(' + k + ',' + k + ',' + k + ')';
		// }
		ctx.fillStyle = fillCSS;
		ctx.fillRect( colorIndex, 0, 1, 1 );
	}
	
	lookupTexture.needsUpdate = true;
}

function getHistoricalData( country ){
	var history = [];	

	var countryName = country.countryName;

	var exportCategories = selectionData.getExportCategories();
	var importCategories = selectionData.getImportCategories();

	for( var i in timeBins ){
		var yearBin = timeBins[i].data;		
		var value = {imports: 0, exports:0};
		for( var s in yearBin ){
			var set = yearBin[s];
			var categoryName = reverseWeaponLookup[set.wc];

			var exporterCountryName = set.e.toUpperCase();
			var importerCountryName = set.i.toUpperCase();			
			var relevantCategory = ( countryName == exporterCountryName && $.inArray(categoryName, exportCategories ) >= 0 ) || 
								   ( countryName == importerCountryName && $.inArray(categoryName, importCategories ) >= 0 );				

			if( relevantCategory == false )
				continue;

			//	ignore all unidentified country data
			if( countryData[exporterCountryName] === undefined || countryData[importerCountryName] === undefined )
				continue;
			
			if( exporterCountryName == countryName )
				value.exports += set.v;
			if( importerCountryName == countryName )
				value.imports += set.v;
		}
		history.push(value);
	}
	// console.log(history);
	return history;
}

function getPickColor(){
	var affectedCountries = undefined;
	if( visualizationMesh.children[0] !== undefined )
		affectedCountries = visualizationMesh.children[0].affectedCountries;

	highlightCountry([]);
	rotating.remove(visualizationMesh);
	mapUniforms['outlineLevel'].value = 0;
	lookupTexture.needsUpdate = true;

	renderer.autoClear = false;
	renderer.autoClearColor = false;
	renderer.autoClearDepth = false;
	renderer.autoClearStencil = false;	
	renderer.preserve

    renderer.clear();
    renderer.render(scene,camera);

    var gl = renderer.context;
    gl.preserveDrawingBuffer = true;

	var mx = ( mouseX + renderer.context.canvas.width/2 );
	var my = ( -mouseY + renderer.context.canvas.height/2 );
	mx = Math.floor( mx );
	my = Math.floor( my );

	var buf = new Uint8Array( 4 );		    	
	gl.readPixels( mx, my, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf );		

	renderer.autoClear = true;
	renderer.autoClearColor = true;
	renderer.autoClearDepth = true;
	renderer.autoClearStencil = true;

	gl.preserveDrawingBuffer = false;	

	mapUniforms['outlineLevel'].value = 1;
	rotating.add(visualizationMesh);


	if( affectedCountries !== undefined ){
		highlightCountry(affectedCountries);
	}
	return buf[0]; 	
}