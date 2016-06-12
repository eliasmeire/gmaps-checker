/**
 * Clientside Scripting - Project - Maps Check
 *
 * @author Elias Meire <elias.meire@student.odisee.be>
 *
 **/

// Encapsulate scripts
;jQuery(function() {
	'use strict';

    /**
    * Application namespace
    * @var object
    */
    var mapsCheck = new Object();
    /**
    * Current destination of the application
    * @var string
    */
	var destination;
    /**
    * Current starting location of the application
    * @var string
    */
	var start;
    /**
    * Current travel mode of the application
    * @var string
    */
	var travelMode;

    /**
    * Function to initialize the application
    */
    mapsCheck.init = function() {
        // Attach events
        this.attachEvents();

        // initialize all modules
        this.mapsModule.init();
        this.graphModule.init();
        this.storageModule.init();               
    }

    /**
    * Function to attach events to buttons/forms/other triggers
    */
    mapsCheck.attachEvents = function() {
        // Calculate travel time form submit
        $('#form1').submit( function(e) {
            e.preventDefault();
            // Check input validity
            if(mapsCheck.checkForm()) {
                // Fill fields with input
                start = $('#start').val();
                destination = $('#destination').val();
                travelMode = $('input[name=mode]').filter(':checked').val();

                // Show directions on map
                mapsCheck.mapsModule.showDirections();

                // Show route duration estimate
                mapsCheck.mapsModule.getRouteDuration(function(result) {
                    if(result !== undefined) {
                        $('#estimate span').text(result.text);
                        $('#estimate').fadeIn();
                    }                  
                });

                // Write to localstorage
                mapsCheck.storageModule.setTravelData();

                // Adjust UI
                $('#btnCalc').hide();
                $('#btnEdit').show();
                $('#toolbar').css('display', 'flex');

                // Disable inputs
                $('#form1 input:not(.btn)').each(function() {
                    $(this).prop('disabled', true);
                });
            }
        });

        // Edit data button
        document.getElementById('btnEdit').addEventListener('click', function() {
            vex.dialog.confirm({
                message: 'Are you sure you want to edit? All data will be deleted.',
                className: 'vex-theme-default',
                callback: function(isOK) {
                    if(isOK) {
                        // Enable inputs
                        $('input:not(.btn)').each(function() {
                            $(this).prop('disabled', false);
                        }); 

                        // Remove all data from localstorage
                        mapsCheck.storageModule.clearAllData();

                        // Remove directions from map
                        mapsCheck.mapsModule.directionsRenderer.setMap(null);

                        // Adjust UI
                        $('#btnEdit').hide();
                        $('#btnCalc').show();                        
                        $('#estimate').fadeOut();
                        $('#toolbar').fadeOut();
                        $('#start').focus();
                    }
                }
            });            
        });

        // Add time button
        document.getElementById('btnAdd').addEventListener('click', function() {
            // Check input validity
            if(mapsCheck.checkTimeInput()) {
                // Calculate time in minutes
                var time = mapsCheck.otherFunctions.getMinutes($('#day').val(), $('#hour').val(), $('#min').val());

                // Get travel duration from Google Maps, display it and add it to the graph
                mapsCheck.mapsModule.getRouteDuration(function(result) {
                    var mapsTime = Math.round(result.value / 60.0);
                    mapsCheck.graphModule.addGraphData(time, mapsTime, mapsCheck.otherFunctions.formatDate(new Date()));
                    $('#estimate span').text(result.text);
                });
            } 
        });

        // Save graph button
        document.getElementById('btnSave').addEventListener('click', function() {
            // If graph is not empty
            if(mapsCheck.graphModule.graph.data.labels.length > 0) {
                // Draw route + mode on the graph before saving
                mapsCheck.graphModule.drawTitle();
                var base64chart = mapsCheck.graphModule.graph.toBase64Image();
                mapsCheck.graphModule.graph.update();
                $.ajax({ 
                    type: 'POST', 
                    url: 'save.php',
                    dataType: 'text',
                    data: {
                        base64data : base64chart
                    }
                }).done(function(response) {                    
                    // Add div to 'savedImages' parent
                    var imgDiv = mapsCheck.otherFunctions.createImgDiv('images/' + response);             
                    document.getElementById('savedImages').appendChild(imgDiv);
                }).fail(function(response) {
                    console.log('Error: image not saved');
                });
            } else {
                vex.dialog.alert({
                    message: 'Graph is empty. Don\'t save empty graphs :(',
                    className: 'vex-theme-default'
                });
            }
        });

        // Delete saved image button
        $('#savedImages').on('click', 'div.savedImg', function() {
            var path = $(this).children('img').first().attr('src');
            var thisImg = $(this);
            vex.dialog.confirm({
                message: 'Are you sure you want to delete this image?',
                className: 'vex-theme-default',
                path: path,
                thisObject: thisImg,
                callback: function(isOK) {
                    if(isOK) {
                        $.ajax({
                            type: 'POST',
                            url: 'delete.php',
                            dataType: 'text',
                            data: {
                                file: this.path
                            }
                        })
                        this.thisObject.fadeOut(500, function() {
                            $(this).remove();
                        });
                    }                    
                }
            });
        });
    }

    /**
    * Function to check the validity of the search form input
    *
    * @return boolean Returns true if form input is valid, else false
    */
    mapsCheck.checkForm = function() {
        // clear error messages
        var $errorMessages = $('.error').each(function() {
            $(this).text('\xa0'); // == &nbsp;
        });

        // check form
        var isValid = true;

        // starting location provided?
        if ($('#start').val() === '') {
            $('#errStart').text('Enter a starting location');
            isValid = false;
        }
        
        // destination provided?
        if ($('#destination').val() === '') {
            $('#errDestination').text('Enter a destination');
            isValid = false;
        }
        
        // travel mode provided?
        if (!$('#driving').prop('checked')
            && !$('#cycling').prop('checked')
            && !$('#walking').prop('checked')) {
            $('#errMode').text('Select a travel mode');
            isValid = false;
        }

        // return
        return isValid;
    }

    /**
    * Function to check the validity of the time input
    *
    * @return boolean Returns true if input is valid, else false
    */
    mapsCheck.checkTimeInput = function() {
        // Clear error messages
        var $errorMessages = $('.error').each(function() {
            $(this).text('\xa0'); // == &nbsp;
        });

        // Fill local variables
        var $hour = $('#hour');
        var $minute = $('#min');
        var $day = $('#day');

        // Check if any unit is filled in
        if ($hour.val() === '' && $minute.val() === '' && $day.val() === '') {
            $('#errTime').text('Please enter a time duration');
            return false;
        } else if($hour.val() < 0 || $minute.val() < 0 || $day.val() < 0) {
            $('#errTime').text('No negative time units allowed');
            return false;
        }
        return true;
    }


    /**
    * Module containing all fields and methods relevant to the graph
    */
    mapsCheck.graphModule = {
        /**
        * The chart.js line chart
        * @var object
        */
        graph: null,

        /**
        * Function to initialize the graph module
        */
        init: function() {
            // Initialize graph
            var canvas = document.getElementById("graph-canvas");
            this.graph = new Chart(canvas, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [
                        {
                            label: "Realistic travel time",
                            fill: false,
                            backgroundColor: "#3367D6",
                            borderColor: "#3367D6",
                            pointBorderColor: "#3367D6",
                            pointBackgroundColor: "#fff",
                            pointHoverBackgroundColor: "#3367D6",
                            pointHoverBorderColor: "#3367D6",
                            pointHoverBorderWidth: 5,
                            data: []
                        },
                        {
                            label: "Google estimate",
                            fill: false,
                            backgroundColor: "#84CA50",
                            borderColor: "#84CA50",
                            pointBorderColor: "#84CA50",
                            pointBackgroundColor: "#fff",
                            pointHoverBackgroundColor: "#84CA50",
                            pointHoverBorderColor: "#84CA50",
                            pointHoverBorderWidth: 5,
                            data: []
                        }
                    ]
                },
                options:{
                    scales: {
                        xAxes: [{                            
                            scaleLabel: {
                                display: true,
                                labelString: 'DateTime DD/MM HH:MM',
                                fontFamily: 'Roboto',
                                fontStyle: 'bold'

                            },
                            ticks: {
                                fontFamily: 'Roboto'
                            }
                        }],
                        yAxes: [{
                            scaleLabel: {
                                display: true,
                                labelString: 'Time (min)',
                                fontFamily: 'Roboto',
                                fontStyle: 'bold'
                            },
                            ticks: {
                                fontFamily: 'Roboto'
                            }
                        }],
                        
                    },
                    tooltips: {
                        mode: 'label',
                        fontFamily: 'Roboto',
                        backgroundColor: 'rgba(42,42,42,1)'
                    }
                }
            });
            
            // Load graph data from local storage
            mapsCheck.storageModule.getGraphData();
            document.getElementById("graph-legend").innerHTML = this.graph.generateLegend();
        },

        /**
        * Function to add a data pair to the graph
        *
        * @param number data1 First member of the data pair
        * @param number data1 Second member of the data pair
        * @param string label Label for the data pair
        */
        addGraphData: function(data1, data2, label) {
            // Add data to graph
            this.graph.data.datasets[0].data.push(parseInt(data1));
            this.graph.data.datasets[1].data.push(parseInt(data2));
            this.graph.data.labels.push(label);
            this.graph.update();

            // Write data to localstorage
            mapsCheck.storageModule.setGraphData();
        },

        /**
        * Function to draw title on the graph (Used when graph needs to be saved)
        *
        */
        drawTitle: function() {
            // Get canvas context
            var canvas = document.getElementById('graph-canvas');
            var context = canvas.getContext("2d");

            // Draw title
            context.fillStyle = 'black';
            context.font = 'bold ' + (canvas.width / 40) + 'px Roboto';
            context.textAlign = 'end';
            context.textBaseline = 'bottom';
            context.fillText(start + ' - ' + destination + ' (' + travelMode + ')', canvas.width, canvas.height);
        }
    }

    /**
    * Module containing all fields and methods relevant to the google map
    */
    mapsCheck.mapsModule = {
        /**
        * The google map
        * @var object
        */
        map: null,
        /**
        * The renderer for the directions service (object defined by google maps API)
        * @var object
        */
        directionsRenderer: null,
        /**
        * The directions service (object defined by google maps API)
        * @var object
        */
        directionsService: null,
        /**
        * The distancematrix service (object defined by google maps API)
        * @var object
        */
        distanceMatrixService: null,

        /**
        * Function to initialize the google maps module
        */
        init: function() {
            // Brussels location
            var brussels = {
                lat: 50.850144,
                lng: 4.349619
            }

            // Initialize map on Brussels
            this.map = new google.maps.Map(document.getElementById('map-canvas'), {
                center: brussels, // Brussels by default
                scroll: false,
                zoom: 16
            });

            var autocompleteStart = new google.maps.places.Autocomplete((document.getElementById('start')),{types: ['geocode']});
            var autocompleteDest = new google.maps.places.Autocomplete((document.getElementById('destination')),{types: ['geocode']});

            // Try to use geolocation and center map on location
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(function(position) {
                    var coords = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    }
                    mapsCheck.mapsModule.map.setCenter(coords);
                    var circle = new google.maps.Circle({
                        center: coords,
                        radius: position.coords.accuracy
                    });
                    autocompleteStart.setBounds(circle.getBounds());
                    autocompleteDest.setBounds(circle.getBounds());
                });
            }

            // Overlay traffic colors
            var trafficLayer = new google.maps.TrafficLayer();
            trafficLayer.setMap(this.map);

            // Recenter map on browser resize. credit: http://codepen.io/jamesnew/pen/HGnrw
            google.maps.event.addDomListener(window, "resize", function() {
                var center = mapsCheck.mapsModule.map.getCenter();
                google.maps.event.trigger(mapsCheck.mapsModule.map, "resize");
                mapsCheck.mapsModule.map.setCenter(center);
            });

            // Initialize Directions service
            this.directionsService = new google.maps.DirectionsService();
            this.directionsRenderer = new google.maps.DirectionsRenderer();

            // Initialize Distance Matrix service
            this.distanceMatrixService = new google.maps.DistanceMatrixService;
        },

        /**
        * Function to show directions on the map
        */
        showDirections: function() {
            // Fill in query for directions service
            var query = {
                origin: start,
                destination: destination,
                travelMode: this.getGMapsTravelMode()
            }

            // Send query to directions service
            this.directionsService.route(query, function(result, status) {
                if (status === google.maps.DirectionsStatus.OK) {
                    mapsCheck.mapsModule.directionsRenderer.setMap(mapsCheck.mapsModule.map);
                    mapsCheck.mapsModule.directionsRenderer.setDirections(result);
                } else {
                    vex.dialog.alert({
                        message: 'Could not find route between start location and destination. Did you make a typo?',
                        className: 'vex-theme-default',
                        callback: function() {
                            $('#form1 input:not(.btn)').each(function() {
                                $(this).prop('disabled', false);
                            }); 

                            mapsCheck.storageModule.clearAllData();

                            $('#btnCalc').show();
                            $('#btnEdit').hide();
                            $('#estimate').fadeOut();
                            $('#start').focus();
                        }
                    });
                }
            });
        },

        /**
        * Function to get the travelmode in correct google maps syntax
        */
        getGMapsTravelMode: function() {
            var gMapsTravelMode;
            switch(travelMode) {
                case 'walking': gMapsTravelMode = google.maps.TravelMode.WALKING;
                                break;
                case 'cycling': gMapsTravelMode = google.maps.TravelMode.BICYCLING;
                                break;
                default: gMapsTravelMode = google.maps.TravelMode.DRIVING;
            }
            return gMapsTravelMode;
        },

        /**
        * Function to get the route duration in traffic (via DistanceMatrix API)
        *
        * @param function callback Callback function to be executed if XMLHttpRequest was succesfull
        */
        getRouteDuration: function(callback) {
            // Fill in variables
            var request = new XMLHttpRequest();
            var mode = this.getGMapsTravelMode().toLowerCase();
            var params = 'start=' + start + '&destination=' + destination + '&mode=' + mode;

            // Handle request response
            request.onreadystatechange = function() {
                if (this.readyState === 4 && this.status === 200) {
                    var result = JSON.parse(this.responseText);

                    // Duration in traffic if mode is driving
                    if(mode === 'driving') callback(result.rows[0].elements[0].duration_in_traffic);

                    // Otherwise normal duration
                    else callback(result.rows[0].elements[0].duration);
                }
            }

            // Send request
            request.open('POST', 'distancematrix.php?' + params);
            request.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
            request.send();
        }
    }

    /**
    * Module containing all fields and methods relevant to the storage
    */
    mapsCheck.storageModule = {
        /**
        * Function to initialize the storage module
        */
        init: function() {
            // Load travel data from localstorage
            if(this.getTravelData()) {
                // Adjust UI
                $('#btnCalc').hide().css('visibility', 'visible');
                $('#btnEdit').css('visibility', 'visible');
                $('#toolbar').css('display', 'flex');

                // Show directions on map
                mapsCheck.mapsModule.showDirections();

                // Show travel duration estimate
                mapsCheck.mapsModule.getRouteDuration(function(result) {
                    $('#estimate span').text(result.text);
                    $('#estimate').fadeIn();
                });
                                     
            }
            else {
                // Adjust UI
                $('#btnEdit').hide().css('visibility', 'visible');
                $('#btnCalc').css('visibility', 'visible');
            }

            // Load graph data from localstorage
            this.getGraphData();

            // Load images from images folder
            $.ajax({
                url : 'images/',
                success: function (response) {
                    $(response).find("a").attr("href", function (i, filename) {
                        if(filename.match(/\.png/)) {
                            // Add div to 'savedImages' parent
                            var imgDiv = mapsCheck.otherFunctions.createImgDiv('images/' + filename);             
                            document.getElementById('savedImages').appendChild(imgDiv);
                        } 
                    });
                }
            });
        },


        /**
        * Function to get travel data from local storage
        * @return boolean Rteurns true if data was found in localStorage, else false
        */
        getTravelData: function() {
            var $startInput = $('#start');
            var $destInput = $('#destination');

            // Check if traveldata is found
            if (localStorage.getItem('travelData')) {
                // Load travel data
                var travelData = JSON.parse(localStorage.getItem('travelData'));
                start = travelData.start;
                destination = travelData.destination;
                travelMode = travelData.mode;

                // Display travel data
                $startInput.val(start);         
                $destInput.val(destination);
                $('#form1 input[value="' + travelMode + '"]').prop('checked', true);

                // Disable inputs
                $('#form1 input:not(.btn)').each(function() {
                    $(this).prop('disabled', true);
                });
                return true;
            }
            return false;
        },

        /**
        * Function to set travel data in local storage
        */
        setTravelData: function() {
            // Initialize travelData object
            var travelData = {
                start: start,
                destination: destination,
                mode: travelMode
            }

            // Write object to localstorage
            localStorage.setItem('travelData', JSON.stringify(travelData));
        },

        /**
        * Function to get graph data from local storage
        */
        getGraphData: function() {
            // Check if graphdata is found
            if (localStorage.getItem('graphData')) {
                // Load graph data
                var graphData = JSON.parse(localStorage.getItem('graphData'));

                // Insert graph data into graph
                mapsCheck.graphModule.graph.data.datasets[0].data = graphData.user;
                mapsCheck.graphModule.graph.data.datasets[1].data = graphData.google;
                mapsCheck.graphModule.graph.data.labels = graphData.labels;
                mapsCheck.graphModule.graph.update();
            }
        },

        /**
        * Function to set graph data in local storage
        */
        setGraphData: function() {
            // Initialize graphData object
            var graphData = {
                user: mapsCheck.graphModule.graph.data.datasets[0].data,
                google: mapsCheck.graphModule.graph.data.datasets[1].data,
                labels: mapsCheck.graphModule.graph.data.labels
            }

            // Write object to localstorage
            localStorage.setItem('graphData', JSON.stringify(graphData));
        },

        /**
        * Function to clear all data in localStorage from this application
        */
        clearAllData: function() {
            // Delete travelData
            localStorage.removeItem('travelData');

            // Delete graphData
            localStorage.removeItem('graphData');

            // Reset graph
            mapsCheck.graphModule.graph.data.datasets[0].data = [];
            mapsCheck.graphModule.graph.data.datasets[1].data = [];
            mapsCheck.graphModule.graph.data.labels = [];
            mapsCheck.graphModule.graph.update();
        }
    }

    /**
    * Module containing all functions that don't fit in another module
    */
    mapsCheck.otherFunctions = {
        /**
        * Function to calculate minutes from days, hours and minutes
        * 
        * @param number days Number of days
        * @param number hours Number of hours
        * @param number minutes Number of minutes
        * @return number Calcuted amount of minutes from days, hours and minutes
        */
        getMinutes: function(days, hours, minutes) {
            var mins = minutes ? parseInt(minutes) : 0;
            mins += days ? days * 1440 : 0;
            mins += hours ? hours * 60 : 0;        
            return mins;
        },

        /**
        * Function to format a date to format DD/MM HH:mm
        * 
        * @param object date The date that needs to be formatted
        * @return string The date formatted as DD/MM HH:mm
        */
        formatDate: function(date) {
            var hours = date.getHours() < 10 ? '0' + date.getHours() : date.getHours();
            var minutes = date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes();
            var day = date.getDate() < 10 ? '0' + date.getDate() : date.getDate();
            var month = (date.getMonth() + 1) < 10 ? '0' + (date.getMonth() + 1) : (date.getMonth() + 1);
            return day + '/' + month + ' ' + hours + ':' + minutes;
        },

        /**
        * Function to create a div for a saved image
        * 
        * @param string path The path to the image file
        * @return object The DOM element for the image
        */
        createImgDiv: function(path) {
            // Create div for image
            var imgDiv = document.createElement('DIV');
            imgDiv.className = 'savedImg';

            // Create image
            var newImg = document.createElement('IMG');
            newImg.src = path;

            // Create delete button
            var btnDelete = document.createElement('BUTTON');
            btnDelete.innerHTML = 'Delete';
            btnDelete.id = 'btnDelete';
            btnDelete.className = 'btn';

            // Append children to div
            imgDiv.appendChild(newImg);
            imgDiv.appendChild(btnDelete);
            return imgDiv;
        }
    }

    // Start scripts
    $(window).on('load', function() {
        // initialize application
        mapsCheck.init();
    });
});