define(['app'], function (app) {

	app.controller('ZWaveController', ['$scope', '$rootScope', '$location', '$http', '$timeout', '$routeParams', '$q',
	function($scope, $rootScope, $location, $http, $timeout, $routeParams, $q) {
		var deviceName = $scope.deviceName = $routeParams.name;
		var devIdx = $scope.idx = $routeParams.idx;

		$scope.dtInstance = {};
		$scope.nodesQueried = false;
		$scope.ownNodeId = -1;
		// Contains the data of the current selected table row
		$scope.current = null;

		$scope.dtOptions = {
 			"sDom": '<"H"lfrC>t<"F"ip>',
              "oTableTools": {
                "sRowSelect": "single",
              },
              "aaSorting": [[ 0, "desc" ]],
              "bSortClasses": false,
              "bProcessing": true,
              "bStateSave": true,
              "bJQueryUI": true,
              "aLengthMenu": [[25, 50, 100, -1], [25, 50, 100, "All"]],
              "iDisplayLength" : 25,
              "sPaginationType": "full_numbers",
              "rowCallback": function(nRow, aData, iDisplayIndex, iDisplayIndexFull) {
              	$(nRow).unbind('click');
		        $(nRow).bind('click', function() {
		            $scope.$apply(function() {
		                $scope.tableRowClick(nRow, aData);
		            });
		        });
		        return nRow;
              },
              "fnPromise": function() {
              	var defer = $q.defer();
    			$.ajax({
		            url: "json.htm?type=openzwavenodes&idx="+devIdx,
		            dataType: 'json',
		            success: function(data) {
		            	if (typeof data.result != 'undefined') {
		                $scope.nodesQueried = data.NodesQueried;
		                $scope.ownNodeId = data.ownNodeId;

		                defer.resolve(
		                	data.result.map(function(item, i){
			                    var status="ok";
			                    if (item.State == "Dead") {
			                        status="failed";
			                    } else if ((item.State == "Sleep")||(item.State == "Sleeping")) {
			                        status="sleep";
			                    } else if (item.State == "Unknown") {
			                        status="unknown";
			                    }
			                    var statusImg='<img src="images/' + status + '.png" />';
			                    var healButton='<img src="images/heal.png" onclick="ZWaveHealNode('+item.NodeID+')" class="lcursor" title="'+$.t("Heal node")+'" />';

			                    var nodeStr = addLeadingZeros(item.NodeID,3) + " (0x" + addLeadingZeros(item.NodeID.toString(16),2) + ")";
			                    return {
			                        "DT_RowId": item.idx,
			                        "Name": item.Name,
			                        "PollEnabled": item.PollEnabled == "true",
			                        "Config": item.config,
			                        "State": item.State,
			                        "NodeID": item.NodeID,
			                        "HaveUserCodes": item.HaveUserCodes,
			                        "0": nodeStr,
			                        "1": item.Name,
			                        "2": item.Description,
			                        "3": item.Manufacturer_name,
			                        "4": item.Product_id,
			                        "5": item.Product_type,
			                        "6": item.LastUpdate,
			                        "7": $.t((item.PollEnabled == "true")?"Yes":"No"),
			                        "8": statusImg+'&nbsp;&nbsp;'+healButton,
			                    };
		                	})
		                )
		            }
		          }
		      });
        		return defer.promise;
              },
              language: $.DataTableLanguage
		}


		$scope.tableRowClick = function(row, data) {
            if ( $(row).hasClass('row_selected') ) {
				$(row).removeClass('row_selected');
            	$scope.current = null;
            } else {
            	$scope.dtInstance.dataTable.$('tr.row_selected').removeClass('row_selected');
                $(row).addClass('row_selected');

            	$scope.current = angular.copy(data);
            	if($scope.current.Config) {
            		$scope.current.Config.forEach(function(item) {
            			item.serverValue = item.value;
            		});
            	}

                var idx= data["DT_RowId"];
                var iNode=parseInt(data["NodeID"]);

                $("#hardwarecontent #zwavecodemanagement").attr("href", "javascript:ZWaveUserCodeManagement(" + idx + ")");

            }
		}

		$scope.RefreshOpenZWaveNodeTable = function()
        {
        	if(!$scope.dtInstance.reloadData) return;
        	$('#modal').show();
        	var resetPaging = true;
    		$scope.dtInstance.reloadData(function() {
    			$('#modal').hide();
    		}, resetPaging);
        }

        $scope.ZWaveCheckIncludeReady = function() {
			$scope.mytimer=$timeout(function() {
				$.ajax({
				 url: "json.htm?type=command&param=zwaveisnodeincluded&idx=" + devIdx,
				 async: false,
				 dataType: 'json',
					 success: function(data) {
						if (data.status == "OK" && data.result==true) {
							//Node included
					        $scope.ozw_node_id = data.node_id;
							$scope.ozw_node_desc = data.node_product_name;
							$("#IncludeZWaveDialog #izwd_waiting").hide();
							$("#IncludeZWaveDialog #izwd_result").show();
						} else {
							//Not ready yet
							$scope.ZWaveCheckIncludeReady();
						}
					 },
					 error: function(){
						$scope.ZWaveCheckIncludeReady();
					 }
				});
			}, 1000);
		}

		$scope.OnZWaveAbortInclude = function() {
			if (typeof $scope.mytimer != 'undefined') {
				$timeout.cancel($scope.mytimer);
				$scope.mytimer = undefined;
			}
			$http({
				url: "json.htm?type=command&param=zwavecancel&idx="+devIdx,
			}).success(function(data) {
				$scope.OnZWaveCloseInclude();
		 	}).error(function() {
				$scope.OnZWaveCloseInclude();
		 	});
		}

		$scope.OnZWaveCloseInclude = function()
		{
			if (typeof $scope.mytimer != 'undefined') {
				$timeout.cancel($scope.mytimer);
				$scope.mytimer = undefined;
			}
			$('#IncludeZWaveDialog').modal('hide');
			$scope.RefreshOpenZWaveNodeTable();
		}

        $scope.ZWaveIncludeNode = function(isSecure) {
			if (typeof $scope.mytimer != 'undefined') {
				$timeout.cancel($scope.mytimer);
				$scope.mytimer = undefined;
			}
			$("#IncludeZWaveDialog #izwd_waiting").show();
			$("#IncludeZWaveDialog #izwd_result").hide();
            $.ajax({
                 url: "json.htm?type=command&param=zwaveinclude&idx=" + devIdx + "&secure=" + isSecure,
                 async: false,
                 dataType: 'json',
                 success: function(data) {
					$scope.ozw_node_id = "-";
					$scope.ozw_node_desc = "-";
           			$('#IncludeZWaveDialog').modal('show');
					$scope.ZWaveCheckIncludeReady();
                 }
            });
        }

		$scope.ZWaveCheckExcludeReady = function() {
			$scope.mytimer=$timeout(function() {
				$.ajax({
			 url: "json.htm?type=command&param=zwaveisnodeexcluded&idx="+devIdx,
			 async: false,
			 dataType: 'json',
				 success: function(data) {
					if (data.status == "OK" && data.result==true) {
						//Node excluded
						$scope.ozw_node_id = data.node_id;
						$scope.ozw_node_desc = "-";
						$("#ExcludeZWaveDialog #ezwd_waiting").hide();
						$("#ExcludeZWaveDialog #ezwd_result").show();
					} else {
						//Not ready yet
						$scope.ZWaveCheckExcludeReady();

					}
				 },
				 error: function(){
					$scope.ZWaveCheckExcludeReady();
				 }
			});
			}, 1000);
		}

		$scope.OnZWaveAbortExclude = function() {
			if (typeof $scope.mytimer != 'undefined') {
				$timeout.cancel($scope.mytimer);
				$scope.mytimer = undefined;
			}
			$http({
			 url: "json.htm?type=command&param=zwavecancel&idx="+devIdx,
			 async: true,
			 dataType: 'json'
			}).success(function(data) {
				$scope.OnZWaveCloseExclude();
			 }).error(function() {
				$scope.OnZWaveCloseExclude();
			 });
		}

		$scope.OnZWaveCloseExclude = function() {
			if (typeof $scope.mytimer != 'undefined') {
				$timeout.cancel($scope.mytimer);
				$scope.mytimer = undefined;
			}
			$('#ExcludeZWaveDialog').modal('hide');
			$scope.RefreshOpenZWaveNodeTable();
		}

        $scope.ZWaveExcludeNode = function() {
			if (typeof $scope.mytimer != 'undefined') {
				$timeout.cancel($scope.mytimer);
				$scope.mytimer = undefined;
			}
			$("#ExcludeZWaveDialog #ezwd_waiting").show();
			$("#ExcludeZWaveDialog #ezwd_result").hide();
            $.ajax({
                 url: "json.htm?type=command&param=zwaveexclude&idx=" + devIdx,
                 async: false,
                 dataType: 'json',
                 success: function(data) {
					$scope.ozw_node_id = data.node_id;
					$scope.ozw_node_desc = "-";
           			$('#ExcludeZWaveDialog').modal('show');
					$scope.ZWaveCheckExcludeReady();
                 }
            });
        }

        $scope.deleteNode = function(node) {
        	if(!node) {
        		return;
        	}
        	var idx = node.DT_RowId;
            bootbox.confirm($.t("Are you sure to remove this node?"), function(result) {
                if (result) {
                  $.ajax({
                    url: "json.htm?type=command&param=deletezwavenode" +
                        "&idx=" + idx,
                     dataType: 'json',
                     success: function(data) {
                        bootbox.alert($.t('Node marked for Delete. This could take some time!'));
                        $scope.RefreshOpenZWaveNodeTable();
                     }
                  });
                }
            });
        }

        $scope.updateNode = function(node) {
        	if(!node) {
        		return;
        	}
        	var idx = node.DT_RowId;

            if ($scope.current.Name=="") {
                ShowNotify($.t('Please enter a Name!'), 2500, true);
                return;
            }
            $.ajax({
                 url: "json.htm?type=command&param=updatezwavenode" +
                    "&idx=" + idx +
                    "&name=" + encodeURIComponent($scope.current.Name) +
                    "&EnablePolling=" + $scope.current.PollEnabled,
                 dataType: 'json',
                 success: function(data) {
                    $scope.RefreshOpenZWaveNodeTable();
                 },
                 error: function(){
                    ShowNotify($.t('Problem updating Node!'), 2500, true);
                    $scope.RefreshOpenZWaveNodeTable();
                 }
            });
        }

        $scope.RequestZWaveConfiguration = function(idx) {
            $.ajax({
                 url: "json.htm?type=command&param=requestzwavenodeconfig" +
                 	"&idx=" + idx,
                 dataType: 'json',
                 success: function(data) {
                    bootbox.alert($.t('Configuration requested from Node. If the Node is asleep, this could take a while!'));
                    $scope.RefreshOpenZWaveNodeTable();
                 },
                 error: function(){
                    ShowNotify($.t('Problem requesting Node Configuration!'), 2500, true);
                 }
            });
        }

        $scope.ApplyZWaveConfiguration = function(node) {
            var valueList = node.Config.map(function(item) {
            	console.log(item);
            	if(item.value !== item.serverValue) {
            		return item.index+"_"+encodeURIComponent(btoa(item.value))+"__";
            	}
            	return "";
            }).join("");

            if (valueList!="") {
                $.ajax({
                     url: "json.htm?type=command&param=applyzwavenodeconfig" +
                        "&idx=" + node.DT_RowId +
                        "&valuelist=" + valueList,
                     dataType: 'json',
                     success: function(data) {
                        bootbox.alert($.t('Configuration send to node. If the node is asleep, this could take a while!'));
                     },
                     error: function(){
                            ShowNotify($.t('Problem updating Node Configuration!'), 2500, true);
                     }
                });
            }
        }

        $scope.ZWaveSoftResetNode = function()
        {
            $.ajax({
                 url: "json.htm?type=command&param=zwavesoftreset" +
                 	"&idx=" + devIdx,
                 dataType: 'json',
                 success: function(data) {
                    bootbox.alert($.t('Soft resetting controller device...!'));
                 }
            });
        }
        $scope.ZWaveHardResetNode = function()
        {
            bootbox.confirm($.t("Are you sure you want to hard reset the controller?\n(All associated nodes will be removed)"), function(result) {
                if (result==true) {
                    $.ajax({
                         url: "json.htm?type=command&param=zwavehardreset" +
                    	     "&idx=" + devIdx,
                         dataType: 'json',
                         success: function(data) {
                            bootbox.alert($.t('Hard resetting controller device...!'));
                         }
                    });
                }
            });


        }

        $scope.ZWaveHealNetwork = function()
        {
            $.ajax({
                 url: "json.htm?type=command&param=zwavenetworkheal" +
                 	"&idx=" + devIdx,
                 dataType: 'json',
                 success: function(data) {
                    bootbox.alert($.t('Initiating network heal...!'));
                 }
            });
        }

        ZWaveHealNode = function(node)
        {
            $.ajax({
                 url: "json.htm?type=command&param=zwavenodeheal" +
                 	"&idx=" + devIdx + "&node=" + node,
                 dataType: 'json',
                 success: function(data) {
                    bootbox.alert($.t('Initiating node heal...!'));
                 }
            });
        }


        $scope.ZWaveReceiveConfiguration = function()
        {
            $.ajax({
                 url: "json.htm?type=command&param=zwavereceiveconfigurationfromothercontroller" +
                 	"&idx=" + devIdx,
                 async: false,
                 dataType: 'json',
                 success: function(data) {
                    bootbox.alert($.t('Initiating Receive Configuration...!'));
                 }
            });
        }

        $scope.ZWaveSendConfiguration = function()
        {
            $.ajax({
                 url: "json.htm?type=command&param=zwavesendconfigurationtosecondcontroller" +
                 	"&idx=" + devIdx,
                 dataType: 'json',
                 success: function(data) {
                    bootbox.alert($.t('Initiating Send Configuration...!'));
                 }
            });
        }

        $scope.ZWaveTransferPrimaryRole = function()
        {
            bootbox.confirm($.t("Are you sure you want to transfer the primary role?"), function(result) {
                if (result==true) {
                    $.ajax({
                         url: "json.htm?type=command&param=zwavetransferprimaryrole" +
                 			"&idx=" + devIdx,
                         dataType: 'json',
                         success: function(data) {
                            bootbox.alert($.t('Initiating Transfer Primary Role...!'));
                         }
                    });
                }
            });
        }

        $scope.ZWaveTopology = function()
        {
            $.ajax({
                 url: "json.htm?type=command&param=zwavestatecheck" +
                 	"&idx=" + devIdx,
                 dataType: 'json',
                 success: function(data) {
                    if (data.status == 'OK') {
                        noty({
                            text: '<center>' + $.t('ZWave Network Information') + '</center><p><p><iframe src="zwavetopology.html?hwid='+devIdx+'" name="topoframe" frameBorder="0" height="'+window.innerHeight*0.7+'" width="100%"/>',
                            type: 'alert',
                            modal: true,
                            buttons: [
                                {addClass: 'btn btn-primary', text: $.t("Close"), onClick: function($noty)
                                    {$noty.close();

                                    }
                                }]
                        });
                    }
                    else {
                        ShowNotify($.t('Error communicating with zwave controller!'), 2500, true);
                    }
                 }
            });
        }


        $scope.ZWaveStartUserCodeEnrollment = function()
        {
            $.ajax({
                 url: "json.htm?type=command&param=zwavestartusercodeenrollmentmode" +
                 	"&idx=" + devIdx,
                 dataType: 'json',
                 success: function(data) {
                    bootbox.alert($.t('User Code Enrollment started. You have 30 seconds to include the new key...!'));
                 }
            });
        }

        $scope.RemoveUserCode = function(index)
        {
            bootbox.confirm($.t("Are you sure to delete this User Code?"), function(result) {
                if (result==true) {
                    $.ajax({
                         url: "json.htm?type=command&param=zwaveremoveusercode&idx=" + $.nodeIdx +"&codeindex=" + index,
                         async: false,
                         dataType: 'json',
                         success: function(data) {
                            RefreshHardwareTable();
                         },
                         error: function(){
                                HideNotify();
                                ShowNotify($.t('Problem deleting User Code!'), 2500, true);
                         }
                    });
                }
            });
        }

        $scope.RefreshOpenZWaveUserCodesTable = function()
        {
          $('#modal').show();

          var oTable = $('#codestable').dataTable();
          oTable.fnClearTable();
          $.ajax({
             url: "json.htm?type=command&param=zwavegetusercodes&idx="+$.nodeIdx,
             dataType: 'json',
             async: false,
             success: function(data) {
                if (typeof data.result != 'undefined') {
                    $.each(data.result, function(i,item){
                        var removeButton='<span class="label label-info lcursor" onclick="RemoveUserCode(' + item.index + ');">Remove</span>';
                        var addId = oTable.fnAddData( {
                            "DT_RowId": item.index,
                            "Code": item.index,
                            "Value": item.code,
                            "0": item.index,
                            "1": item.code,
                            "2": removeButton
                        } );
                    });
                }
             }
          });
            /* Add a click handler to the rows - this could be used as a callback */
            $("#codestable tbody").off();
            $("#codestable tbody").on( 'click', 'tr', function () {
                if ( $(this).hasClass('row_selected') ) {
                    $(this).removeClass('row_selected');
                }
                else {
                    var oTable = $('#codestable').dataTable();
                    oTable.$('tr.row_selected').removeClass('row_selected');
                    $(this).addClass('row_selected');
                    var anSelected = fnGetSelected( oTable );
                    if ( anSelected.length !== 0 ) {
                        var data = oTable.fnGetData( anSelected[0] );
                        //var idx= data["DT_RowId"];
                    }
                }
            });
          $('#modal').hide();
        }

        $scope.ZWaveUserCodeManagement = function(idx)
        {
            $.nodeIdx=idx;
            cursordefault();
            var htmlcontent = '';
            htmlcontent+=$('#openzwaveusercodes').html();
            var bString="EditOpenZWave("+$.devIdx+",'"+$.devName + "',0,0,0,0,0)";
            $('#hardwarecontent').html(GetBackbuttonHTMLTable(bString)+htmlcontent);
            $('#hardwarecontent').i18n();
            $('#hardwarecontent #nodeidx').val(idx);
            var oTable = $('#codestable').dataTable( {
              "sDom": '<"H"lfrC>t<"F"ip>',
              "oTableTools": {
                "sRowSelect": "single",
              },
              "aaSorting": [[ 0, "desc" ]],
              "bSortClasses": false,
              "bProcessing": true,
              "bStateSave": true,
              "bJQueryUI": true,
              "aLengthMenu": [[25, 50, 100, -1], [25, 50, 100, "All"]],
              "iDisplayLength" : 25,
              "sPaginationType": "full_numbers",
              language: $.DataTableLanguage
            } );
            RefreshOpenZWaveUserCodesTable();
        }

	}]);





	app.directive('i18n', [function() {
		return {
			compile: function ($elem, $attrs) {
				$elem.text($.t($attrs.i18n));
			}
		};
   	}]);

});