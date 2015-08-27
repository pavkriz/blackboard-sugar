// ==UserScript==
// @name         BlackBoard Sugar UHK.cz
// @namespace    uhk.cz
// @author       Pavel Kriz <pavel.kriz@uhk.cz>
// @description  Sweet custom user-script enhancements for BlackBoard Learn LMS's instructors. Developed for use at the University of Hradec Kralove.
// @grant        none
// @require		 https://ajax.googleapis.com/ajax/libs/jquery/2.1.0/jquery.min.js
// @include      http://oliva.uhk.cz/*
// @include      https://oliva.uhk.cz/*
// ==/UserScript==


jQuery.noConflict();

(function( $ ) {
  $(function() {
      
        var courseHooks = [];
      
        // TODO make course-specific (UHK.cz) hooks external
        courseHooks.push({
            forCourse : function(course_id, course_title) {
                return (course_title.indexOf('DORDB') == 0);
            },
            provideSummaryValue: function(row, colByName) {
                var sum = '';
                if (row[colByName['Semestrální projekt'].id] >= 15) { // min 15 bodu z projektu
                    sum += '<span style="color: #009933; font-size: 20px; font-weight: bold">☑</span>';
                } else {
                    sum += '<span style="color: #CC0000; font-size: 20px; font-weight: bold"><b>☐</b></span>';
                }
                if (row[colByName['Zápočtový test'].id] >= 11 || row[colByName['Zápočtový test PF opravný'].id] >= 11) { // min 11 bodu ze zap. testu
                    sum += '<span style="color: #009933; font-size: 20px; font-weight: bold">☑</span>';
                } else {
                    sum += '<span style="color: #CC0000; font-size: 20px; font-weight: bold"><b>☐</b></span>';
                }
                // min 24 bodu ze zkousky (nutno projit vsechny sloupce zacinajici ZK
                var zkOk = false;
                $.each(colByName, function(col_name, col) {
                    if (col_name.indexOf('ZK') == 0) {
                        // nazev sloupce zacina na ZK
                        // overit, zda hodnota ve sloupci neni zrusena
                        if (!row[colByName[col_name].id+'__canceled']) {
                        	var val = row[colByName[col_name].id];
                        	if (val >= 24) {
                            	zkOk = true;
                        	}
                        }
                    }
                });
                if (zkOk) {
                    sum += '<span style="color: #009933; font-size: 20px; font-weight: bold">☑</span>';
                } else {
                    sum += '<span style="color: #CC0000; font-size: 20px; font-weight: bold"><b>☐</b></span>';
                }
                var zk = '';
                var total = row[colByName['Total'].id];
                // vypocitat pripadne znamku ze zkousky
                //Body v intervalu <90, 100> výborný
			    //Body v intervalu <70, 89> velmi dobrý
				//Body v intervalu <50, 69> dobrý
				//Body v intervalu < 0, 49> nevyhovující 
                if (total >= 90) {
                    zk = 1;
                } else if (total >= 70) {
                    zk = 2;
                } else if (total >= 50) {
                    zk = 3;
                }
                sum += zk;
                return sum;
            }
        });

      	var getURLParameter = function(name) {
          return decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(location.search)||[,""])[1].replace(/\+/g, '%20'))||null
        };
        
        var addCss = function(url) {
            var link = document.createElement('link');
            link.rel = 'stylesheet';
            link.type = 'text/css';
            link.href = url;
            document.getElementsByTagName("HEAD")[0].appendChild(link);
        };
        
        var addJs = function(url, callback) {
          var script = document.createElement("script");
          script.setAttribute("src", url);
          if (callback) {
            script.addEventListener('load', function() {
                var script = document.createElement("script");
                script.textContent = "(" + callback.toString() + ")();";
                document.body.appendChild(script);
            }, false);
          }
          document.body.appendChild(script);
        };
      
        var parseDateTimeSmart = function(dateStr) {
            // try strict english 13-Aug-2014 17:15:54
            var d = moment(dateStr, "DD-MMM-YYYY HH:mm:ss", 'en', true);
            if (d.isValid()) {
                return d;
            } else {
                // TODO try other formats and/or locales
                return null;
            }                
        };
        
        sugarShowNiceGradebook = function showNiceGradebook(course_id, course_title) {
            $("<div id='sugar-overlay' style='padding: 10px;'>"
              + "<div><button type='button' id='sugar-close' style='cursor: pointer; background: 0 0; border: 0; font-size: 21px; font-weight: 700; line-height: 1; color: #000; text-shadow: 0 1px 0 #fff; filter: alpha(opacity=40); opacity: .4'>×</button></div>"
              + "<div id='sugar-loading'>Loading gradebook data...</div>"
              + "<div id='sugar-table'></div></div>").css({
                "width": "100%",
                "background-color": "#FFF"
            }).prependTo("body");                    
            $('#sugar-close').click(function() {
                $('#sugar-overlay').remove();
            });
            // load gradebook (JSON)
            $.ajax({
                type: 'GET',
                url: '/webapps/gradebook/do/instructor/getJSONData?course_id='+course_id,
                cache: false,
                dataType: 'json',
                success: function (result) {
                    $('#sugar-loading').html('Loading gradebook history...');
                    // load gradebook history (HTML)
                    $.get("/webapps/gradebook/do/instructor/getGradeHistory?numDays=90&numResults=1000&course_id="+course_id, function(histResult) {
                        $('#sugar-loading').remove();
                                                
                        // convert BB gradebook data to Handsontable (HOT)
                        var colHeaders = [ 'Last action', 'Summary' ];
                        var colDefs = [ {data: '_lastActionDateStr'}, {data: '_summary'} ];
                        var dynaColumns = colDefs.length;
                        var colByName = {};
                        $.each(result.colDefs, function(index, col) {
                            colHeaders.push(col.name);
                            colDefs.push({data: col.id});
                            colByName[col.name] = { id: col.id, index: index+dynaColumns };
                        });
                        var data = [];
                        $.each(result.rows, function(rowIndex, row) {
                            var record = { _lastActionDateObj: null, _lastActionDateStr: null }; // used by first (dynamic_ column containing the date of the last action
                            $.each(row, function(colIndex, cell) {
                                if (cell.c) {
                                    if (cell.hasOwnProperty("tv")) {
                                        record[cell.c] = cell.tv;
                                    } else {
                                        record[cell.c] = cell.v;
                                    }
                                    if (cell.hasOwnProperty("x") && cell.x == 'y') {
                                        // canceled value
                                        record[cell.c+'__canceled'] = true;
                                    }
                                }
                            });
                            data.push(record);
                        });
                        
                        var histCellAge = [];
                        var histAgeOldest = moment(); // today, we may found older record, then replace
   						var histResult = $(histResult); // parse HTML by jquery
                        // iterate over history records
                        histResult.find('#listContainer_databody tr').each(function(rowIndex) {
                            var histRecord = {};
                            $(this).find('td,th').each(function(colIndex) {
                                var text = ($(this).text() === undefined) ? undefined : $(this).text().replace(/^\s+|\s+$/g, ''); // trim
                                switch (colIndex) {
    								case 0:
                                        histRecord.date = text;
                                        histRecord.dateObj = parseDateTimeSmart(histRecord.date);
                                        break;
                                    case 1:
                                        histRecord.column = text;
                                        break;
                                    case 2:
                                        histRecord.actor = text;
                                        break;
                                    case 3:
                                        histRecord.student = text;
                                        break;
                                    case 4:
                                        histRecord.info = text;
                                        break;
                                    case 5:
                                        histRecord.attempDate = text;
                                        histRecord.attempDateObj = parseDateTimeSmart(histRecord.attempDate);
                                        break;
                                    case 6:
                                        histRecord.comments = $(this).html();
                                        break;
                                }
                            });
                            // update oldest (if necessary)
                            if (histRecord.dateObj.isBefore(histAgeOldest)) {
                                histAgeOldest = histRecord.dateObj;
                            }

                            // find row in data table by Student's name
                            $.each(data, function(rowIndex, row) {
                                if (row.FN+' '+row.LN == histRecord.student) {
                                    // student (row) found
                                    // save the latest date
                                    if (row._lastActionDateObj) {
                                        if (histRecord.dateObj.isAfter(row._lastActionDateObj)) {
                                            row._lastActionDateObj = histRecord.dateObj;
                                            row._lastActionDateStr = histRecord.dateObj.format('YYYY-MM-DD HH:mm:ss');
                                        }
                                    } else {
                                        row._lastActionDateObj = histRecord.dateObj;
                                        row._lastActionDateStr = histRecord.dateObj.format('YYYY-MM-DD HH:mm:ss');
                                    }
                                    // find column
                                    var col = colByName[histRecord.column];
                                    if (col) {
                                        var colIndex = col.index;
                                        histCellAge[rowIndex] = histCellAge[rowIndex] || []; // initialize row array;
                                        var cell = histCellAge[rowIndex][colIndex];
                                        // save the latest date
                                        if (cell) {
                                            if (histRecord.dateObj.isAfter(cell)) {
                                                histCellAge[rowIndex][colIndex] = histRecord.dateObj;
                                            }
                                        } else {
                                            histCellAge[rowIndex][colIndex] = histRecord.dateObj;
                                        }
                                        
                                    }
                                }
                            });
                        });
                        
                        var minMilis = histAgeOldest.valueOf();
                        var maxMilis = moment().valueOf();
                        
                        var heatmapScale  = chroma.scale(['rgb(244,109,67)','rgb(253,174,97)','rgb(254,224,139)','rgb(255,255,191)','rgb(230,245,152)','rgb(171,221,164)','rgb(102,194,165)']);

                        var point = function point(value, min, max) {
 							return (1 - ((value - min) / (max - min)));
						}
                        
                        var cellRenderer = function(instance, td, row, col, prop, value, cellProperties) {
                            if (prop == '_summary') {
                                Handsontable.renderers.HtmlRenderer.apply(this, arguments);
                            } else {
                            	Handsontable.renderers.TextRenderer.apply(this, arguments);
                            }
                            
                            if (instance.sortIndex &&  instance.sortIndex.length > 0) {
                            	row = instance.sortIndex[row][0];
                            }
                            
                            if(histCellAge[row] && histCellAge[row][col]) {
                                td.style.backgroundColor = heatmapScale(point(histCellAge[row][col].valueOf(), minMilis, maxMilis)).hex();
                                //console.log( chroma.scales.hot(1).hex() );
                            } else if (prop == '_lastActionDateStr' && data[row]._lastActionDateObj) {
                                td.style.backgroundColor = heatmapScale(point(data[row]._lastActionDateObj.valueOf(), minMilis, maxMilis)).hex();
                            }
                            
                            td.style.color = 'black';
                            
                            if (data[row][prop+'__canceled']) {
                                td.style['text-decoration'] = 'line-through';
                            }
                        };
                        
                        // handle hooks
                        $.each(courseHooks, function(index, hook) {
                            if (hook.forCourse(course_id, course_title)) {
                                $.each(data, function(index, row) {
                                	row['_summary'] = hook.provideSummaryValue(row, colByName);
                                });
                            }
                                
                        });
                        
                        $('#sugar-table').handsontable({
                            data: data,
                            columns: colDefs,
                            colHeaders: colHeaders,
                            fixedColumnsLeft: result.numFrozenColumns+dynaColumns, // First name, Last name
                            columnSorting: true,
                            comments: true,
                            colWidths: 170,
                            manualColumnResize: true,
                            cells: function (row, col, prop) {
                                    var cellProperties = {};
                                    cellProperties.readOnly = true;
                                	cellProperties.renderer = cellRenderer;
                                	//cellProperties.comment = 'test';  
                                    return cellProperties;
                                  }
                        });
                        //console.log(colDefs);
                        //console.log(data);                    
                        //console.log(result);
   					});

                }
            });
        };
        

                
                
        // *** main **********************************************************************************************
                
        if (location.pathname == '/webapps/gradebook/do/instructor/enterGradeCenter') {
            var course_id = getURLParameter('course_id');
            var course_title = courseTitle; // global variable
            console.log('SUGAR: grade center '+course_id);
            $('#nav').append('<li class="mainButton" style="position: relative;"><a id="sugar-show-nice" href="javascript:void(0)" style="background-color: #52A358;">UHK: Pretty table</a></li>');
            $('#sugar-show-nice').click(function(e) {
                if ($('#sugar-overlay').length > 0) {
                    $('#sugar-overlay').remove();
                }
                sugarShowNiceGradebook(course_id, course_title);
                e.preventDefault();
            });
        }
    	
    	      
        // Handsontable (HOT)
        addJs('http://handsontable.com//bower_components/handsontable/dist/handsontable.full.min.js');
        addCss('http://handsontable.com//bower_components/handsontable/dist/handsontable.full.min.css');
        
        // Moment.js (date-time manipulation)
        addJs('//cdnjs.cloudflare.com/ajax/libs/moment.js/2.7.0/moment-with-langs.js');
      
        // Chroma.js
        addJs('//cdnjs.cloudflare.com/ajax/libs/chroma-js/0.5.7/chroma.min.js');
  });
})(jQuery);
