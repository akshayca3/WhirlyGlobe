var url = 'http://mousebird-home.asuscomm.com:8080/api/json?depth=2&pretty=true&tree=jobs[name,lastBuild[number,duration,timestamp,result,estimatedDuration]]'
var s3Url = "https://s3-us-west-1.amazonaws.com/whirlyglobemaplydistribution/";

function getAPIData() {
	$.getJSON(url,function(jenkinsJSON) { 
		jQuery.ajax({
			type:"GET",
			url: s3Url,
			async: true,
			dataType: "xml",
			success: function(s3XML) {
				buildUI(jenkinsJSON, s3XML);
			},
			error : function(error) {
				document.getElementById("table").innerHTML = "<div class='alert alert-danger'><strong>Something bad happened...</strong> Mr. Jenkins seems to be too busy... try again later</div>";
			}
		});
	}).error(function() {
		document.getElementById("table").innerHTML = "<div class='alert alert-danger'><strong>Mr. Jenkins is unable to report his status...</strong>Probably you need to allow unsafe scripts execution in your web browser.</div>";
	});
}

function buildUI(jenkinsJSON, s3XML) {
	var items = [];
	$.each (jenkinsJSON, function (x1, y1) {
		if (x1 == "jobs") {
			var table = "<div class='table-responsive builds text-center'><table class='table table-bordered'><thead><tr><th>Name</th><th>Status</th><th>Last Duration</th><th>Build Count</th><th>Last Result</th><th>Last Run Date</th><th>Last Binary</th><th>Other Binaries</th></tr></thead><tbody>";
			$.each (y1, function(x2, y2) {
				table = table + convertJobToHTMLRow(y2, s3XML);
			});
			table = table +"</tbody></table></div>";
			document.getElementById("table").innerHTML = table;
		}
	});
}

function timeConverter(UNIX_timestamp) {
  var a = new Date(UNIX_timestamp);

  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var year = a.getFullYear();
  var month = months[a.getMonth()];
  var date = a.getDate();
  var hour = a.getHours();
  if (hour < 10) {
  	hour = "0"+hour;
  }
  var min = a.getMinutes();
  if (min < 10) {
  	min = "0"+min;
  }
  var time = date + ' ' + month + ' ' + year + ' ' + hour + ':' + min;
  return time;
}

function getDuration(seconds) {
	var sec_num = parseInt(seconds, 10); // don't forget the second param
    var hours   = Math.floor(sec_num / 3600);
    var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
    var seconds = sec_num - (hours * 3600) - (minutes * 60);

    var result = "";
    if (hours > 0) {
    	if (minutes < 10) { minutes = "0"+minutes; }
    	result = hours + ":" + minutes + " hours";
    }
    else if (minutes > 0) {
    	if (seconds < 10) { seconds = "0"+seconds; }
    	result = minutes + ":" + seconds + " minutes";
    }
    else if (seconds > 0) {
    	result = seconds + " seconds";
    }
    return result;
}

function convertJobToHTMLRow(job, s3XML) {
	var data = getArrayDataJob(job);
	if (data === null) {
		return;
	}

	var html = "<tr>";
	for (var i = 0; i < data.length; i++) {
		switch (i) {
			case 0:
			case 1:
			case 4:
			case 5:
				html = html + "<td><p>" + data[i] + "</p></td>";
				break;
			case 2:
				if (data[i] != "") {
					html = html + "<td><p>" + getDuration(data[i]/1000) + "</p></td>";
				}
				else {
					html = html +"<td></td>";
				}
				break;
			case 3:
				break;
			case 6:
				if (data[i] != "") {
					html = html + "<td><p>" + timeConverter(data[i]) + "</p></td>";
				}
				else {
					html = html +"<td></td>";
				}
				break;
			default:
				break;
		}
	}
	var fields = data[0].split('_');
	var binaries = getS3Data(s3XML, data[0], fields[1]);
	if (binaries.length > 0) {
		var lastBinary = binaries[binaries.length-1];
		var binaryName = lastBinary.split("/");
		html = html + "<td><a href="+s3Url+lastBinary+">"+binaryName[1]+"</a></td><td>"
		if (binaries.length > 1) {
			html = html + "<button type='button' class='btn btn-info btn-md' data-toggle='modal' data-target='#"+data[0]+"'>See More</button>";
			html = html + "<div id='"+data[0]+"' class='modal fade' role='dialog'><div class='modal-dialog'>";
			html = html + "<div class='modal-content'><div class='modal-header tutorial-main'><button type='button' class='close' data-dismiss='modal'>&times;</button><h2>Binaries</h2></div>";
			html = html + "<div class='modal-body tutorial tutorial-main'>";
			for (var i = binaries.length-2; i >= 0 ; i--){
				binaryName = binaries[i].split("/");
				html = html + "<p><a href="+s3Url+binaries[i]+">"+binaryName[1]+"</a></p>"
			}
			html = html+"</div><div class='modal-footer'><button type='button' class='btn btn-default' data-dismiss='modal'>Close</button></div></div></div></div></td>";
		}
		else {
			html = html+"None</td>";
		}
	}
	else {
		html = html + "<td>None</td><td>None</td>";
	}

	return html + "</tr>";
}

function getArrayDataJob(job){

	/**
		Position:Description
		0: Name
		1: Status
		2: Last Duration
		3: Estimated Duration
		4: Execution Number
		5: Last Build Result
		6: Last Execution Date
	*/
	var data = [];

	for (var i = 0; i < 7; i++) {
		data.push("");
	}

	$.each(job, function(x1, y1) {
		switch (x1) {
			case "name":
				data[0] = y1.startsWith("AutoTester_") ? null : y1
				break;
			case "lastBuild":
				if (y1 != null && y1 != undefined) {
					if (y1['result'] === null) {
						data[1] = "Running...";
						data[2] = "";
						data[5] = "";
					}
					else {
						data[1] = "Idle";
						data[2] = y1['duration'];
						data[5] = y1['result'];
					}
					
					data[3] = y1['estimatedDuration'];
					data[4] = y1['number'];
					data[6] = y1['timestamp'];
 				}
				break;
			default:
				break;
		}
	});
	return data[0] === null ? null : data;
}

function getS3Data(dataXML, testName, platform)
{
	var binaries = [];
	$(dataXML).find('Contents').each(function() {
		var key = $(this).find('Key').text();
		if (key.toLowerCase().includes(platform) && !key.toLowerCase().includes("latest")) {
			if (testName.toLowerCase().includes("nightly")) {
				if (key.toLowerCase().includes("nightly")) {
					binaries.push(key);
				}
			}
			else {
				if (!key.toLowerCase().includes("nightly")) {
					binaries.push(key);
				}
			}
		}
	});
	binaries.sort(function(a, b) {
		function getOrdinal(str) {
			var rawElements = str.split("/");
			var elements = rawElements[1].split("_");
			if (str.toLowerCase().includes("nightly")){
				return parseInt(elements[2]);
			}
			else {
				return parseInt(elements[1].split(".")[0]);
			}
		}
		
		return getOrdinal(a) - getOrdinal(b);
	});
	return binaries;
}