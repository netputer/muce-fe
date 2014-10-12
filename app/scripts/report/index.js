define([
    'report/highchart',
    'report/reportCtrl',
    'report/sidebarCtrl',
    'report/delPanelCtrl',
    'report/settingCtrl',
    'report/tableCtrl',
    'report/resModal'
], function(highchart) {

    var Config = {
        delAlertPrefix: 'Are you sure you wish to delete ',
        quickDataList: _.zip(
            'Last day,Last 2 days,Last 3 days,Last 1 week,Last 2 week,Last 1 month'.split(','), [-1, -2, -3, -7, -14, -31]
        ),
        periodFormatMap: {
            0: 'yyyy-MM-dd',
            1: 'yyyy-MM-dd hh:mm'
        },
        apiDateFormatMap: {
            0: 'yyyyMMdd',
            1: 'yyyyMMddhh'
        },
        csvFileNameTpl: '[MUCE REPORT] <%= report %> - <%= start %>_<%= end %>'
    };
    window.Config = Config;

    var routeInfo = {
        'report': {
            url: '/report',
            views: {
                'sidebar@report': {
                    templateUrl: 'templates/report/sidebar.html',
                    controller: 'sidebarCtrl'
                },
                'setting@report': {
                    templateUrl: 'templates/report/setting.html',
                    controller: 'settingCtrl'
                },
                '@': {
                    templateUrl: 'templates/report/index.html',
                    controller: 'reportCtrl'
                }
            }
        },
        'report.detail': {
            url: '/:group/:category/:report?startDate&endDate&period&dimensions&filters',
            templateUrl: 'templates/report/chart-table.html',
            controller: 'detailCtrl'
        },
        'report.management': {
            url: '^/management',
            abstract: true,
            views: {
                '@': {
                    templateUrl: 'templates/report/management.html'
                }
            }
        },
        'report.management.metric': {
            url: '/metric',
            views: {
                'pannel@report.management': {
                    templateUrl: 'templates/report/management/metric.html',
                    controller: 'viewMetricsCtrl'
                }
            }
        },
        'report.management.dimension': {
            url: '/dimension',
            views: {
                'pannel@report.management': {
                    templateUrl: 'templates/report/management/dimension.html',
                    controller: 'viewDimensionsCtrl'
                }
            }
        },
        'report.management.report': {
            url: '/report',
            views: {
                'pannel@report.management': {
                    templateUrl: 'templates/report/management/report.html',
                    controller: 'viewReportsCtrl'
                }
            }
        }
    };

    var viewCtrls;
    (function buildViewCtrls() {
        viewCtrls = _.map(['metric', 'dimension', 'report'], function(type) {
            return ['$scope', 'apiHelper', '$rootScope', '$modal', function($scope, apiHelper, $rootScope, $modal) {
                var capitalizeType = _.capitalize(type);
                apiHelper('getDetail' + capitalizeType + 'sList').then(function(data) {
                    $scope[type + 'List'] = data;
                });

                $scope['del' + capitalizeType] = function(item) {
                    apiHelper('del' + capitalizeType, item.id).then(function() {
                        var alertTip = Config.delAlertPrefix + type + ' ' + item.name;
                        if (!window.confirm(alertTip)) return;
                        // remove metric from list
                        $scope[type + 'List'] = _.without($scope[type + 'List'], item);
                    });
                }

                $scope['edit' + capitalizeType] = function(item) {
                    var newScope = $scope.$new(true);
                    $scope._data = _.clone(item);

                    var templateUrl;
                    if (!$scope.delMetric) {
                        templateUrl = 'templates/report/modal.html';
                    } else {
                        templateUrl = 'report/metric-tabs-modal.html';
                    }
                    $modal.open({
                        templateUrl: templateUrl,
                        controller: type + 'ModalCtrl',
                        scope: $scope,
                        size: 'lg'
                    });
                };
            }]
        });
    })();

    function detailCtrl($scope, $state, apiHelper, $timeout, $filter, $rootScope) {
        var _state = $rootScope.state;
        _state.isAjaxFetching = false;

        function triggerFetchDone(data) {
            $rootScope.$emit('report:renderReportData', [_state.reportDetail, data]);
            _state.isFetching = false;
            _state.isAjaxFetching = false;
        }

        $rootScope.$on('report:fetchReportData', function() {
            var defaultParams = {
                filters: [],
                cache: true,
                dimensions: []
            };
            if (_state.isAjaxFetching) return;
            _state.isAjaxFetching = true;
            apiHelper('getReport', _state.report.id, {
                busy: 'global',
                params: _.extend(defaultParams, _.pick($state.params, 'period', 'startDate', 'endDate'))
            }).then(function(data) {
                highchart.buildLineChart(_state.reportDetail, data);
                if ($state.params.dimensions && ($state.params.dimensions != '[]')) {
                    apiHelper('getReport', _state.report.id, {
                        busy: 'global',
                        params: _.extend(defaultParams, _.pick($state.params, 'period', 'startDate', 'endDate', 'filters', 'dimensions'))
                    }).then(function(data) {
                        triggerFetchDone(data);
                    });
                } else {
                    triggerFetchDone(data);
                }
            }, function() {});
        });
    }

    /* add modal */
    function addModalCtrl($scope, $modal) {
        $scope.addTypes = ['group', 'category', 'report', 'metric', 'dimension'];
        $scope.openModal = function(type) {
            if (type !== 'metric') {
                $modal.open({
                    templateUrl: 'templates/report/modal.html',
                    controller: type + 'ModalCtrl',
                    size: 'lg'
                });
            } else {
                $modal.open({
                    templateUrl: 'report/metric-tabs-modal.html',
                    size: 'lg'
                });
            }
        };
    }

    function buildCtrlDepArr(ctrlNames) {
        return _.map(ctrlNames, function(name) {
            return 'muceApp.report.' + name;
        });
    }

    angular.module('muceApp.report',
        buildCtrlDepArr(['delPanelCtrl', 'reportCtrl', 'sidebarCtrl', 'settingCtrl', 'tableCtrl']).concat(['muceApp.report.resModal']))
        .controller('addModalCtrl', addModalCtrl)
        .controller('detailCtrl', detailCtrl)
        .controller('viewMetricsCtrl', viewCtrls[0])
        .controller('viewDimensionsCtrl', viewCtrls[1])
        .controller('viewReportsCtrl', viewCtrls[2])
        .config(function($stateProvider, $urlRouterProvider) {
            _.each(routeInfo, function(opt, name) {
                $stateProvider.state(name, opt);
            });
            $urlRouterProvider
                .when('/management', '/management/report')
        });
});