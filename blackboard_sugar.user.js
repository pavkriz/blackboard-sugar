// ==UserScript==
// @name         BlackBoard Sugar UHK.cz
// @namespace    uhk.cz
// @author       Pavel Kriz <pavel.kriz@uhk.cz>
// @description  Sweet custom user-script enhancements for BlackBoard Learn LMS's instructors. Developed for use at the University of Hradec Kralove.
// @require      https://ajax.googleapis.com/ajax/libs/jquery/2.1.0/jquery.min.js
// @include      http://oliva.uhk.cz/*
// @include      https://oliva.uhk.cz/*
// ==/UserScript==

function getURLParameter(name) {
  return decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(location.search)||[,""])[1].replace(/\+/g, '%20'))||null
}

sugarShowNiceGradebook = function showNiceGradebook(course_id) {
    $.ajax({
        type: 'GET',
        url: '/webapps/gradebook/do/instructor/getJSONData?course_id='+course_id,
        cache: false,
        dataType: 'json',
        success: function (result) {
            $("<div id='sugar-overlay'><button type='button' id='sugar-close' style='position: relative; top: 2px; right: 21px; padding: 0; cursor: pointer; background: 0 0; border: 0; float: right; font-size: 21px; font-weight: 700; line-height: 1; color: #000; text-shadow: 0 1px 0 #fff; filter: alpha(opacity=40); opacity: .4'>×</button>"
              	+ "<h1>Sugar</h1>" + result.dataFormat + "</div>").css({
                    "width": "100%",
                    "background-color": "#FFF"
                }).prependTo("body");
            $('#sugar-close').click(function() {
                $('#sugar-overlay').remove();
            });
            console.log(result);
        }
    });
}

if (location.pathname == '/webapps/gradebook/do/instructor/enterGradeCenter') {
    var course_id = getURLParameter('course_id');
    console.log('SUGAR: grade center '+course_id);
    $('#nav').append('<li class="mainButton" style="position: relative;"><a id="sugar-show-nice" href="javascript:void(0)">UHK: Show nice</a></li>');
    $('#sugar-show-nice').click(function(e) {
        if ($('#sugar-overlay').length > 0) {
            $('#sugar-overlay').remove();
        } else {
        	sugarShowNiceGradebook(course_id);
        }
   		e.preventDefault();
	});
}
