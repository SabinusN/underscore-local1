/* eslint-disable */

const gec = (function (gec) {
    /* ***********************
    1.Sealer//this is how we handle private properties over different files
    2.Methods Definitions
    3.Object/Enum Definitions

    ********************** */

    var gecPrivate = gec.gecPrivate = gec.gecPrivate || {},
        gecSeal = gec.gecSeal = gec.gecSeal || function () {
            delete gec.gecPrivate;
            delete gec.gecSeal;
            delete gec.gecUnseal;
        },
        gecUnseal = gec.gecUnseal = gec.gecUnseal || function () {
            gec.gecPrivate = gecPrivate;
            gec.gecSeal = gecSeal;
            gec.gecUnseal = gecUnseal;
        };

    var _version = {
        implementationVersion: "15.1.0"
    };
    var _aapiVersion = "2.2";


    gecPrivate._GBEHeader = {
        version: 2,
        fragmentLanguage: "Javascript",
        fragmentVersion: "",
        clientIdentifier: "GEC"
    };

    var socket = null;
    var listExchangeMarketsXHR;

    var _convertBodyItem = function (newObject, name, value, converter) {

        if (name == "") return newObject;

        var names = name.split("-");
        if (names.length > 1) {
            var namePrefix = names[0].split("V")[0];
            var index = (names[0].split("V")[1] * 1) - 1;

            var remainingName = name.substr(name.indexOf("-") + 1);

            if (converter[namePrefix] == null) {
                converter = converter[0];
            }
            if (newObject[namePrefix] == null) {
                newObject[namePrefix] = [];
            }
            if (newObject[namePrefix][index] == null) {
                newObject[namePrefix][index] = {};
            }
            return _convertBodyItem(newObject[namePrefix][index], remainingName, value, converter[namePrefix]);
        } else {
            if (converter[name] == null) {
                converter = converter[0];
            }

            if (value == "T") value = true;
            if (value == "F") value = false;

            newObject[converter[name]] = value;
        }

        return newObject;
    };
    //Set all delegates to not fired for when we reconnect push
    var resetFiredDelegates = function () {
        if (gecPrivate._subscribedExchangeMarket !== undefined) {
            Object.keys(gecPrivate._subscribedExchangeMarket).forEach(function(item) {
                gecPrivate._subscribedExchangeMarket[item].prototype.resetFiredDelegates();
            });
        }
        if (gecPrivate._subscribedExchangeEvent !== undefined) {
            Object.keys(gecPrivate._subscribedExchangeEvent).forEach(function(item) {
                gecPrivate._subscribedExchangeEvent[item].prototype.resetFiredDelegates();
            });
        }
        if (gecPrivate.subscribedExchangeEventTabs !== undefined) {
            Object.keys(gecPrivate.subscribedExchangeEventTabs).forEach(function(item) {
                gecPrivate.subscribedExchangeEventTabs[item].prototype.resetFiredDelegates();
            });
        }
        if (gecPrivate._subscribedExchangeSelection !== undefined) {
            Object.keys(gecPrivate._subscribedExchangeSelection).forEach(function(item) {
                gecPrivate._subscribedExchangeSelection[item].prototype.resetFiredDelegates();
            });
        }
        if (gecPrivate._subscribedRacePool !== undefined) {
            Object.keys(gecPrivate._subscribedRacePool).forEach(function(item) {
                gecPrivate._subscribedRacePool[item].prototype.resetFiredDelegates();
            });
        }
        if (gecPrivate._subscribedRace !== undefined) {
            Object.keys(gecPrivate._subscribedRace).forEach(function(item) {
                gecPrivate._subscribedRace[item].prototype.resetFiredDelegates();
            });
        }
        if (gecPrivate._subscribedRunner !== undefined) {
            Object.keys(gecPrivate._subscribedRunner).forEach(function(item) {
                gecPrivate._subscribedRunner[item].prototype.resetFiredDelegates();
            });
        }
        if (gecPrivate._subscribedCTV !== undefined) {
            Object.keys(gecPrivate._subscribedCTV).forEach(function(item) {
                gecPrivate._subscribedCTV[item].prototype.resetFiredDelegates();
            });
        }
        if (gecPrivate._subscribedRTV !== undefined) {
            Object.keys(gecPrivate._subscribedRTV).forEach(function(item) {
                gecPrivate._subscribedRTV[item].prototype.resetFiredDelegates();
            });
        }
        if (gecPrivate._subscribedGTV !== undefined) {
            Object.keys(gecPrivate._subscribedGTV).forEach(function(item) {
                gecPrivate._subscribedGTV[item].prototype.resetFiredDelegates();
            });
        }
    }

    gec.aapiId = {
        setAnonymousSessionContext: 1,
        logonPunter: 2,
        logoffPunter: 3,
        subscribePoolBettingSummary: 4,
        subscribeRaceInformation: 5,
        subscribeRacePools: 6,
        subscribeCardTaggedValueChanges: 7,
        subscribeRaceTaggedValueChanges: 8,
        subscribeGenericTaggedValueChanges: 15,
        subscribeAsynchronousResponse: 18,
        unsubscribe: 20,
        listSubscriptions: 21
    };


    gec.Controller = function (params) {

        var controllerDefaults = {
            language: "en",
            integrationPartnerId: 0,
            currency: 'EUR',
            organisationalUnitId: 1,
            priceFormat: 1
        };
        var clientLogConfig = params.clientLogConfig;

        var mockIAPI = params.mockIAPI; // mock IAPI used for unit-testing of GEC

        gecPrivate._base = com.globalbettingexchange.base;
        var _params = params;
        var _cookieRefreshRate = 60000; // millieseconds
        var _cookieTimeout = 3600000; // millieseconds

        // Values used when storing the session token in a cookie
        var _storeSessionTokenInCookieWithExpiryTime = false;
        var sessionTokenCookieName = "IAPISessionToken";
        gecPrivate.userContextCookieName = "GECUserContext";
        gecPrivate.sameSiteValueForCookies = params.sameSiteValueForCookies;
        gecPrivate.controllerDefaults = controllerDefaults;
        gecPrivate._version = _version;
        gecPrivate._aapiVersion = _aapiVersion;

        var _logClientEntries = false;
        var _apisNotToBeSentClientLogging = [];
        var _queueingIAPISettings = { isEnabled: false };
        var _queueingGECSystemParams = {};

        gecPrivate.numberOfGetRacesCallsToLog = 1;
        gecPrivate.numberOfRaceStatusUpdatesToLog = 5;
        gecPrivate.numberOfPoolStatusUpdatesToLog = 30;

        var _pushHealthcheck = {
            enabled: false,
            timeout: 5000,
            interval: 5000
        }
        gecPrivate._pushHealthcheck = _pushHealthcheck;

        //useAjax, check same domain policy, check Flash, useProxy
        var _thisController = this;
        gecPrivate._debug = false;
        gecPrivate._thisController = _thisController;
        this.isStreamingEnabled = false;

        var _onControllerLoaded = params.onLoaded; //fired why all objects and proxies have been created but before any apis called
        var _proxyController;

        gecPrivate._isConnecting = false;

        gecPrivate.userContext = null;
        gecPrivate.userContextAAPI = null;
        gecPrivate.sessionToken = undefined;

        var _telebetSessionToken = null;
        gecPrivate._arbitrarySessionToken = null;
        var _oddsLadder = null;
        gecPrivate._eventClassifiers = { 1: new gec.EventClassifier() }; //used to store eventClassifiers in cache including hostoric events
        gecPrivate._markets = {}; //used to store markets in cache indexed by id
        gecPrivate._selections = {}; //used to store selections in cache
        gecPrivate._eventClassifiersForClient = []; //used to store eventClassifiers cache for client

        var _eventsMarkets = {};

        var _topLevelId = 1; // 181582;
        var _connectionHealth = 0;
        gecPrivate._maxSequenceNo = 0;
        gecPrivate._bootstrapFailedAttempts = 0;

        var _deletedOrderIds = {};
        gecPrivate._orderCache = {};
        gecPrivate.pollChangedOrdersTime = 5000;
        gecPrivate._orderCacheInterval = null;
        var _overlays = [];

        gecPrivate._aapiSessionToken;
        gecPrivate._correlationData = [];
        gecPrivate._pushMessages = {};
        gecPrivate._subscriptions = [];
        gecPrivate._subscriptionData = [];

        gecPrivate._connectionHealthChangeDelegates = [];

        gecPrivate._subscribedCard = {};
        gecPrivate._subscribedCardILDelegates = [];
        gecPrivate._subscribedCardDeltaDelegates = [];
        gecPrivate._subscribedRace = {};
        gecPrivate._subscribedRaceILDelegates = [];
        gecPrivate._subscribedRaceDeltaDelegates = [];
        gecPrivate._subscribedRacePool = {};
        gecPrivate._subscribedRacePoolILDelegates = [];
        gecPrivate._subscribedRacePoolDeltaDelegates = [];
        gecPrivate._subscribedRunner = {};
        gecPrivate._subscribedRunnerILDelegates = [];
        gecPrivate._subscribedRunnerDeltaDelegates = [];
        gecPrivate._subscribedCTV = {};
        gecPrivate._subscribedCTVILDelegates = [];
        gecPrivate._subscribedCTVDeltaDelegates = [];
        gecPrivate._subscribedRTV = {};
        gecPrivate._subscribedRTVILDelegates = [];
        gecPrivate._subscribedRTVDeltaDelegates = [];
        gecPrivate._subscribedGTV = {};
        gecPrivate._subscribedGTVILDelegates = [];
        gecPrivate._subscribedGTVDeltaDelegates = [];
        gecPrivate._subscribedAsyncResponse = {};
        gecPrivate._subscribedAsyncResponseILDelegates = [];
        gecPrivate._subscribedAsyncResponseDeltaDelegates = [];

        gecPrivate._subscribedExchangeEventILDelegates = [];
        gecPrivate._subscribedExchangeMarketILDelegates = [];
        gecPrivate._subscribedExchangeSelectionILDelegate = [];
        gecPrivate._subscribedMarketScoresILDelegate = [];
        gecPrivate._subscribedExchangeSelectionPricesILDelegate = [];
        gecPrivate._subscribedExchangeSelectionFixedOddsPricesILDelegate = [];
        gecPrivate._subscribedExchangeMarketMatchedAmountILDelegate = [];


        gecPrivate._subscribedCustomHierarchyNode = {};
        gecPrivate._subscribedExchangeEvent = {};
        gecPrivate._subscribedExchangeEventMatchedAmount = {};
        gecPrivate._subscribedExchangeMarket = {};
        gecPrivate._subscribedExchangeMarketMatchedAmount = {};

        gecPrivate._subscribedExchangeMarketNew = {};
        gecPrivate._subscribedExchangeSelection = {};
        gecPrivate._subscribedExchangeSelectionMatchedAmount = {};
        gecPrivate._subscribedItemNames = {};
        gecPrivate._subscribedMarketScores = {};
        gecPrivate._subscribedOrder = {};
        gecPrivate._subscribedExchangeSelectionPrices = {};
        gecPrivate._subscribedExchangeSelectionIndexedPrices = {};
        gecPrivate._subscribedExchangeSelectionFixedOddsPrices = {};
        gecPrivate._subscribedSelectionPAndL = {};
        gecPrivate._subscribedSelectionPriceHistory = {};

        gecPrivate.passwordValidityRegExp = params.passwordValidityRegExp;
        this.setPasswordValidityRegExp = function (passwordValidityRegExp) {
            gecPrivate.passwordValidityRegExp = passwordValidityRegExp;
        };

        gecPrivate.disableStreamingInitialisation = params.disableStreamingInitialisation;
        gecPrivate.neverCallRefreshArbitrarySessionInformation = params.neverCallRefreshArbitrarySessionInformation;

        gecPrivate.makeIAPIRequestsWithContentTypeJSON = params.makeIAPIRequestsWithContentTypeJSON;

        //temp credentials while waitig for AAPIcalls lodgeFunds
        var _username;
        var _password;

        var _eventPollInterval = null;
        var _eventCacheRefreshRate = 120000; //2 minute refresh
        gecPrivate._lastPingRoundtripMS = 0;
        gecPrivate._lastPingedAt = 0;
        var _pingHandle;
        var _pingInterval = 30000;
        var _controllerLoadedTimeout = 1000;
        var _pushHealthcheckHandle;
        var _haveReceivedAtLeastOneStreamingMessage = false;


        var _callBack = [];
        this.setCallBack = function (guid, request, callBack) {
            _callBack[guid] = function (response) { callBack.call(this, request, response); };
        }
        this.doCallBack = function (guid, response) {
            _callBack[guid].call(this, response);
            delete _callBack[guid];
        }

        gecPrivate.addToCorrelation = function (params) {
            var correlationId = gecPrivate._correlationData.length;
            gecPrivate._correlationData[correlationId] = params;
            return correlationId;
        }

        this.sendRequest = function () { alert("Not Set"); }; // assigned when we know ajaxViaController

        //kiosk specific events
        this.onCashStacked;
        this.onSingleTicketEscrowed;
        this.onMultipleTicketEscrowed;
        this.onSingleTicketStacked;
        this.onMultipleTicketStacked;
        this.onCashTicketEscrowed;
        this.onCashTicketStacked;
        this.onPrinterEvent;

        //mobile events here
        this.homeButtonPressed;
        this.menuButtonPressed;

        var _retryRequestURLs = [
            "/ListOrdersChangedSince.ashx",
            "/ListBootstrapOrders.ashx"
        ];
        var _isRetryRequestURL = function (page) {
            for (var i = 0; i < _retryRequestURLs.length; i++) {
                if (_retryRequestURLs[i] === page) {
                    return true;
                }
            }
            return false;
        }
        var _createUUID = function () {
            // http://www.ietf.org/rfc/rfc4122.txt
            var s = [];
            var hexDigits = "0123456789abcdef";
            for (var i = 0; i < 36; i++) {
                s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
            }
            s[12] = "4";  // bits 12-15 of the time_hi_and_version field to 0010
            s[16] = hexDigits.substr((s[16] & 0x3) | 0x8, 1);  // bits 6-7 of the clock_seq_hi_and_reserved to 01

            s[8] = '-';
            s[13] = '-';
            s[19] = '-';
            s[25] = '-';

            var uuid = s.join("");
            return uuid + '';
        }
        function ClientLogger() {

            var GUIDs = {
                "application": _createUUID()
            };

            this.init = function (section) {
                GUIDs[section] = _createUUID();
            };

            this.logClientEntry = function (params) {

                // Limit logging to certain punters via PTV
                if (clientLogConfig && clientLogConfig.enableLogging) {

                    /*
                    1   PunterInteraction   This ClientLogEntry logs an explicit action taken by the punter.
                    2   ExternalSystemInteraction   This ClientLogEntry logs an explicit interaction initiated by an external system (e.g. a containing web page).
                    3   ClientApplicationAction This ClientLogEntry logs an action initiated by the client application (e.g. a timed event)
                    4   ConfigurationInformation    This ClientLogEntry just records configuration information (and not an explicit event).
                    */
                    var userInteractionType = params.userInteractionType || 1;

                    _thisController.addClientLogEntry({
                        clientName: clientLogConfig.clientName,
                        clientVersion: clientLogConfig.clientVersion,
                        logEntry: params.logEntry,
                        eventTime: params.eventTime || new Date().toISOString(),
                        eventEndTime: params.eventEndTime || new Date().toISOString(),
                        clientLogEntryType: params.clientLogEntryType || 1,
                        userInteractionType: userInteractionType, //1=mouse 2 key
                        systemInteractionType: 1,
                        componentName: params.componentName,//left nav, homepage, event card, mode, right nav,
                        subcomponentName: params.subcomponentName,
                        itemSelected: GUIDs[params.componentName],
                        importance: 1,
                        entryCode1: params.entryCode1,
                        entryCode2: params.entryCode2,
                        entryCode3: params.entryCode3,
                        entryCode4: params.entryCode4
                    });

                }
            };

        };

        gecPrivate.clientLogger = new ClientLogger();

        var _callBack = [];
        this.setCallBack = function (guid, request, callBack) {
            _callBack[guid] = function (response) { callBack.call(this, request, response); };
        }
        this.doCallBack = function (guid, response) {
            _callBack[guid].call(this, response);
            delete _callBack[guid];
        }

        gecPrivate.addToCorrelation = function (params) {
            var correlationId = gecPrivate._correlationData.length;
            gecPrivate._correlationData[correlationId] = params;
            return correlationId;
        }

        var pushHealthcheckEnabled = function () {
            if (_pushHealthcheck.user && _pushHealthcheck.user.enabled) {
                return true;
            }
            return _pushHealthcheck.enabled;
        }

        var pushHealthcheckInterval = function () {
            if (_pushHealthcheck.user && _pushHealthcheck.user.interval) {
                return _pushHealthcheck.user.interval;
            }
            return _pushHealthcheck.interval;
        }

        var pushHealthcheckTimeout = function () {
            if (_pushHealthcheck.user && _pushHealthcheck.user.timeout) {
                return _pushHealthcheck.user.timeout;
            }
            return _pushHealthcheck.timeout;
        }

        // Add the message to object (keyed by the correlationId) to check that we have received a response. 
        // On the callback we will remove this message. The object will be checked periodically and
        // if there are old messages i.e. messages we haven't received a response for, we will
        // initiate a reconnect
        gecPrivate.addToPushMessages = function (params) {
            if (pushHealthcheckEnabled()) {
                // Start the timer if it doesn't already exist
                if (!_pushHealthcheckHandle) {
                    clearPushMessages();
                    _pushHealthcheckHandle = window.setInterval(function () {
                        checkPushMessages();
                    }, pushHealthcheckInterval());

                    if (gecPrivate.userContext && gecPrivate.userContext.partnerUsername) {
                        gecPrivate.clientLogger.logClientEntry({
                            clientLogEntryType: 3,
                            componentName: "application",
                            subcomponentName: "push",
                            logEntry: "SOCK: Starting healthcheck for punter: " + gecPrivate.userContext.partnerUsername
                        });
                    }
                }

                var messageObj = { sentTime: Date.now(), request: params };
                gecPrivate._pushMessages[params[0]] = messageObj;
            }
        }

        gecPrivate.removeFromPushMessages = function (correlationId) {
            // Remove the message from the list once ou have received a response
            delete gecPrivate._pushMessages[correlationId];
        }

        var clearPushMessages = function () {
            gecPrivate._pushMessages = {};
        }

        var checkPushMessages = function () {
            if (pushHealthcheckEnabled() && _thisController.streamingConnectionDetails) {
                // Loop through all the keys in the object
                for (var key in gecPrivate._pushMessages) {
                    if (gecPrivate._pushMessages.hasOwnProperty(key)) {
                        // Check the timestamp of the key and see of it is old
                        if (gecPrivate._pushMessages[key].sentTime < Date.now() - pushHealthcheckTimeout()) {


                            gecPrivate.clientLogger.logClientEntry({
                                clientLogEntryType: 3,
                                componentName: "application",
                                subcomponentName: "push",
                                logEntry: "SOCK: Response timeout, forcing reconnection"
                            });


                            // Close the connection and reconnect
                            _onConnectionLost();
                        }
                    }
                }
            }
        };

        var stopPushHealthcheckTimer = function () {
            if (_pushHealthcheckHandle != null) {
                window.clearInterval(_pushHealthcheckHandle);
                _pushHealthcheckHandle = null;
            }
            clearPushMessages();
        }
        gecPrivate.stopPushHealthcheckTimer = stopPushHealthcheckTimer;

        this.sendRequest = function () { alert("Not Set"); }; // assigned when we know ajaxViaController

        //kiosk specific events
        this.onCashStacked;
        this.onSingleTicketEscrowed;
        this.onMultipleTicketEscrowed;
        this.onSingleTicketStacked;
        this.onMultipleTicketStacked;
        this.onCashTicketEscrowed;
        this.onCashTicketStacked;
        this.onPrinterEvent;

        //mobile events here
        this.homeButtonPressed;
        this.menuButtonPressed;



        /** Return a Promise for a specified GEC method. This maps
         *  callbackOnSuccess -> resolve()
         *  callbackOnException -> reject()
         * @input {string} methodName
         * @input {Object} inputs for API call
         * @return {Promise}
        **/
        this.getPromise = function (methodName, inputs) {

            var gec = this;

            return new Promise(function (resolve, reject) {

                inputs["callbackOnSuccess"] = function (response) {
                    resolve(response);
                };

                inputs["callbackOnException"] = function (response) {
                    reject(response);
                };

                gec[methodName](inputs);
            });
        }

        function connect(url, onComplete, sockOptions) { //declared at this scope as needed again for reconnect function

            var options = sockOptions;

            if (sockOptions.length) {//backward compatibile to transport array
                options = { transports: sockOptions, debug: false };
            }

            socket = new SockJS(url, null, options);

            socket.onmessage = function (e) {
                _haveReceivedAtLeastOneStreamingMessage = true;
                logConsole("socket receiving... " + e.data);
                if (e.data[0] === "{") {
                    _onDataEventJSON(e.data);
                } else {
                    var webClientMessage = new GBEWebClientMessage(e.data);
                    _onDataEvent(webClientMessage);
                }
            };

            socket.onopen = function (params) {
                logConsole("socket opened");
                if (onComplete) {
                    onComplete(true);
                }
                _onSocketOpen(true);
            };

            socket.onerror = function (error) {
                logConsole("socket error");
                logConsole(error);
            };

            socket.onclose = function (params) {
                logConsole("socket closed...");
                logConsole(params);
                socket = null;
                _onSocketClose(onComplete);
            };
        }

        function logConsole(message) {
            if (_thisController.streamingConnectionDetails.debug) {
                console.log(message);
            }
        }

        function isStreamingEnabledAtGECInstantiation() {

            if (gecPrivate.disableStreamingInitialisation === true) {
                return false;
            }

            return (_thisController.streamingConnectionDetails !== undefined);
        }

        this.initStreaming = function (params) {
            _thisController.isStreamingEnabled = true;
            if (socket === null) {
                connect(_thisController.streamingConnectionDetails.sockURL, params.callbackOnSuccess, _thisController.streamingConnectionDetails.options || _thisController.streamingConnectionDetails.transports);
            } else {
                params.callbackOnSuccess();
            }
        };

        this._init = function () {

            if (isStreamingEnabledAtGECInstantiation()) {
                if (_pingHandle != null) {
                    window.clearInterval(_pingHandle);
                }

                stopPushHealthcheckTimer();

                if (_thisController.streamingConnectionDetails
                    && _thisController.streamingConnectionDetails.sockURL !== undefined) {

                    //do sock.js connection
                    connect(_thisController.streamingConnectionDetails.sockURL, undefined, _thisController.streamingConnectionDetails.options || _thisController.streamingConnectionDetails.transports);
                }

            }

            if (mockIAPI) {

                this.sendRequest = mockIAPI.mockIAPIRequestHandler;

            } else {

                //use Ajax
                this.sendRequest = this.makeAjaxRequest;

                if (!isStreamingEnabledAtGECInstantiation()) {

                    if (_storeSessionTokenInCookieWithExpiryTime) {

                        var sessionAlreadyExists = (gecPrivate._base.getCookie(sessionTokenCookieName) != "");
                        gecPrivate.sessionToken = gecPrivate._base.getCookie(sessionTokenCookieName);
                        var userContextCookie = gecPrivate._base.getCookie(gecPrivate.userContextCookieName);
                        var userContext = {};
                        if (userContextCookie != "") {
                            userContext = JSON.parse(userContextCookie);
                            gecPrivate.userContext = userContext;
                        }

                        if (sessionAlreadyExists) {
                            _arbRefreshID = window.setInterval(function () {
                                if (_storeSessionTokenInCookieWithExpiryTime && isSessionTokenCookieExpired())
                                    return;

                                if (_keepAlive) {

                                    if (gecPrivate.sessionToken != null)
                                        extendLifeOfSessionTokenCookie();

                                    _keepAlive = false;

                                    // If callback exists, call it to let calling code know we have extended the session
                                    if (_params.onSessionExtended)
                                        _params.onSessionExtended.call();
                                }
                            }, _cookieRefreshRate);
                        }
                        //must be fired on timout because systemparams may be passed as object not stirng like "web"
                        if (_onControllerLoaded && !loadedAlreadyFired) {
                            loadedAlreadyFired = true;
                            window.setTimeout(function () {
                                _onControllerLoaded(sessionAlreadyExists, userContext);
                            }, 100);
                        }
                    }
                    else {

                        if (_onControllerLoaded && !loadedAlreadyFired) {
                            loadedAlreadyFired = true;
                            window.setTimeout(function () {
                                _onControllerLoaded(false, null);
                            }, 100);
                        }

                    }

                }
            }
        }



        // Ajax calls via Controller (Flash/ActiveX-kiosk) - used when calling different domain and
        // flash/controller installed
        this.sendControllerRequest = function (page, request) {
            var guid = new Date().getTime();
            _thisController.setCallBackArray(guid, request.onSuccess);

            var req = "?";

            for (obj in request) {
                req += "&" + obj + "=" + request[obj];
            }

            return _proxyController.sendRequest(params.iapiURL + page, guid, req);
        }
        this.controllerResponseReceived = function (guid, response) {
            response = JSON.parse(response);
            _thisController.getCallBackArray()[guid].call(null, response);
            _thisController.deleteCallBackArray(guid);
        }

        function apiNameFromPageName(page) {
            return page.replace(/^\//, "").replace(/\.aspx$/, "").replace(/\.ashx$/, "");   // e.g. "/GetRaces.aspx" -> "GetRaces"
        }

        function isQueueTokenRequired(apiName) {
            if (_queueingIAPISettings.isEnabled !== true) {
                return false;
            }
            return _queueingIAPISettings.appliesTo.includes(apiName);
        }

        // Ajax calls via JQuery Javascript - used when calling same domain
        this.makeAjaxRequest = function makeAjaxRequest(page, request, callBack, xmlhttp, timeoutLimit, isAsyncEnrolPunter) {
            var thisGEC = this;
            var apiName = apiNameFromPageName(page);

            if (isQueueTokenRequired(apiName) && !request.queueToken) {
                thisGEC.queueAjaxRequest(page, request, callBack, xmlhttp, timeoutLimit, isAsyncEnrolPunter);
            } else {
                thisGEC.sendAjaxRequest(page, request, callBack, xmlhttp, timeoutLimit, isAsyncEnrolPunter);
            }
        };

        this.queueAjaxRequest = function queueAjaxRequest(page, request, callBack, xmlhttp, timeoutLimit, isAsyncEnrolPunter) {
            var thisGEC = this;
            var requestQueueTokenRequest = {
                iapiName: apiNameFromPageName(page),
                partnerUsername: apiNameFromPageName(page) === "EstablishSession" ? request.partnerUsername : undefined,
                reCAPTCHAToken: apiNameFromPageName(page) === "EstablishSession" ? request.reCAPTCHAToken : undefined,
                queueTokenIdentifier: request.queueToken ? request.queueToken.queueTokenIdentifier : undefined
            };

            thisGEC.sendAjaxRequest("/RequestQueueToken.aspx", requestQueueTokenRequest, function (requestQueueTokenRequest, requestQueueTokenResponse) {

                var delayInSecondsIfQueueIsFull = 5;

                if (requestQueueTokenResponse.returnCode === gec.ReturnCode.QueueFull) {
                    request.callbackOnQueueingOfRequest(delayInSecondsIfQueueIsFull);
                    setTimeout(function () {
                        thisGEC.queueAjaxRequest(page, request, callBack, xmlhttp, timeoutLimit, isAsyncEnrolPunter);
                    }, delayInSecondsIfQueueIsFull * 1000);
                    return;
                }

                if (requestQueueTokenResponse.returnCode !== gec.ReturnCode.Success
                    && requestQueueTokenResponse.returnCode !== gec.ReturnCode.QueueingNotEnabled) {
                    callBack.call(this, request, {
                        returnCode: requestQueueTokenResponse.returnCode
                    });
                    return;
                }

                if (_queueingGECSystemParams.adjustWaitTimeInSeconds !== undefined &&
                    requestQueueTokenResponse.waitTimeInSeconds !== undefined) {
                    requestQueueTokenResponse.waitTimeInSeconds = requestQueueTokenResponse.waitTimeInSeconds + _queueingGECSystemParams.adjustWaitTimeInSeconds;
                }

                request.queueToken = requestQueueTokenResponse.queueToken;

                if (requestQueueTokenResponse.queueToken &&
                    requestQueueTokenResponse.waitTimeInSeconds > 0) {

                    if (request.callbackOnQueueingOfRequest) {
                        request.callbackOnQueueingOfRequest(requestQueueTokenResponse.waitTimeInSeconds);
                    }
                    setTimeout(function () {
                        thisGEC.sendAjaxRequest(page, request, handleAjaxResponse, xmlhttp, timeoutLimit, isAsyncEnrolPunter);
                    }, requestQueueTokenResponse.waitTimeInSeconds * 1000);
                } else {
                    thisGEC.sendAjaxRequest(page, request, handleAjaxResponse, xmlhttp, timeoutLimit, isAsyncEnrolPunter);
                }

                function handleAjaxResponse(request, response) {
                    switch (response.returnCode) {
                        case gec.ReturnCode.QueueTokenNotYetValid:
                            setTimeout(function () {
                                thisGEC.sendAjaxRequest(page, request, handleAjaxResponse, xmlhttp, timeoutLimit, isAsyncEnrolPunter);
                            }, 1000);
                            break;
                        case gec.ReturnCode.InvalidQueueToken:
                            delete request.queueToken;
                            thisGEC.queueAjaxRequest(page, request, handleAjaxResponse, xmlhttp, timeoutLimit, isAsyncEnrolPunter);
                            break;
                        default:
                            callBack.call(this, request, response);
                    }
                }

            });

        }

        this.sendAjaxRequest = function sendAjaxRequest(page, request, callBack, xmlhttp, timeoutLimit, isAsyncEnrolPunter) {

            var req = gecPrivate._base.clone(request);
            var apiName = apiNameFromPageName(page);
            var thisGEC = this;

            xmlhttp = xmlhttp || new XMLHttpRequest();
            if ("withCredentials" in xmlhttp) {
                xmlhttp.withCredentials = (apiName === "RequestQueueToken") ? false : true;
            } else if (typeof XDomainRequest != "undefined") {
                // Otherwise, check if XDomainRequest.
                // XDomainRequest only exists in IE, and is IE's way of making CORS requests.
                xmlhttp = new XDomainRequest();
            } else {
                // Otherwise, CORS is not supported by the browser.
                xmlhttp = null;
            }

            var TIMEOUTLIMIT = timeoutLimit || 60000;
            if (req.sign) {
                req.timeStamp = new Date().getTime();
                req.sign = this.signData(req.timeStamp);
            }

            if (_logClientEntries
                && !_apisNotToBeSentClientLogging.includes(apiName)) {
                req.clientLogEntries = getLogEntries();
            }

            delete req.onSuccess;
            delete req.onException;

            var requestString = JSON.stringify(req);
            var parameters;

            if (apiName === "RequestQueueToken") {
                xmlhttp.open("POST", params.queueTokenProviderURL + page, true);
            } else if (isAsyncEnrolPunter) {
                xmlhttp.open("POST", params.asyncEnrolPunterURL + page, true);
            } else {
                xmlhttp.open("POST", params.iapiURL + page, true);
            }

            if (gecPrivate.makeIAPIRequestsWithContentTypeJSON) {
                parameters = requestString;
                xmlhttp.setRequestHeader("Content-type", "application/json");
            } else {
                parameters = "request=" + urlencode(requestString);
                xmlhttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
            }

            xmlhttp.timeout = TIMEOUTLIMIT;

            xmlhttp.ontimeout = function ontimeout() {
                // IAPI call timed out. Act as if it returned ResourceError, so that the calling application gets some callback called and does not hang
                callBack.call(this, request, {
                    returnCode: gec.ReturnCode.ResourceError
                });
            }

            xmlhttp.onreadystatechange = function onreadystatechange() {
                if (xmlhttp.readyState == 4) {
                    var status = 0;

                    try {
                        status = xmlhttp.status
                    } catch (e) {
                        status = -2;
                    } //IE timeout issue
                    // Check for HTML/XML being returned instead of JSON as expected
                    if (xmlhttp.responseText.trim()[0] === "<") {
                        // Data returned begins with < so is not JSON, don't try to parse it
                        status = -2;
                    }
                    if (status == 200) {
                        if (xmlhttp.responseText == "") {
                            xmlhttp.responseText = "{'returnCode':-2}";
                        }
                        var resp = JSON.parse(xmlhttp.responseText);

                        if (resp.returnCode === gec.ReturnCode.QueueTokenNotSpecified) {
                            thisGEC.queueAjaxRequest(page, request, callBack, undefined, timeoutLimit, isAsyncEnrolPunter);
                        } else {
                            callBack.call(this, request, resp);
                        }

                    } else {
                        xmlhttp.responseText = "{'returnCode':2}";
                        if (_isRetryRequestURL(page)) {
                            callBack.call(this, request, xmlhttp.responseText);
                        }
                    }
                    xmlhttp.responseText = null;
                    xmlhttp.onreadystatechange = null;
                    xmlhttp.abort = null;
                    xmlhttp = null;
                    delete xmlhttp;
                }
            };
            xmlhttp.send(parameters);

        };
        this.cleanUp = function () {
            for (var i in gecPrivate._subscribedExchangeMarket) {

                var delegateCount = gecPrivate._subscribedExchangeMarket[i].prototype.getDelegateCount();

                if (delegateCount < 1) {
                    var marketId = gecPrivate._subscribedExchangeMarket[i].marketId;

                    for (var j in gecPrivate._subscribedExchangeSelection) {
                        if (gecPrivate._subscribedExchangeSelection[j].marketId == marketId)
                            delete gecPrivate._subscribedExchangeSelection[j];
                    }
                    delete gecPrivate._subscribedExchangeMarket[i];

                }
            }
        }

        this.getVersion = function () {
            return _version;
        }

        var GBEWebClientMessage = function (data) {

            this.payload = data.replace(/AAPI\//, "\u0003"); //added spance but not right - 

            var messagePairs = this.payload.split("\u0001");
            var headers = messagePairs[0].split("\u0002");
            var isInitialLoad = headers[2] === "T";
            var isChange = headers[2] === "F";
            var isDelete = headers[2] === "X";

            var fields = [];
            for (var i = 1; i < messagePairs.length; i = i + 1) {
                fields.push(messagePairs[i]);
            }

            this.topic = (messagePairs[0].substring(0, messagePairs[0].indexOf("\u0002"))).trim();

            var header = messagePairs[0].substring(0, messagePairs[0].lastIndexOf("\u0002"));

            this.isInitialTopicLoad = function () {
                return isInitialLoad;
            };
            this.isDeleteTopic = function () {
                return isDelete;
            };
            this.getHeader = function () {
                return header;
            };
            this.getNumberOfRecords = function () {
                return fields.length;
            };
            this.getFields = function (i) {
                return fields[i].split("\u0002");
            };
            this.localeTimeString = function () {
                var now = new Date();

                return now.toISOString();
            }

        }

        var _onDataEventJSON = function (messageJSON) {
            var message = JSON.parse(messageJSON);
            var mappingArray = gecPrivate._AAPIJSONResponseMappings;
            var matches;

            // Find appropriate mapping for this pushed item
            mappingArray.forEach(function (mapping) {
                if (mapping.aapiId !== undefined
                    && message.aapiId === mapping.aapiId) {

                    mapping.method.call(null, message);

                } else if (message.header !== undefined
                    && mapping.topicNameRegex !== undefined) {

                    matches = message.header.topicName.match(mapping.topicNameRegex);
                    if (matches !== null) {
                        mapping.method.call(null, message, matches);
                    }
                }
            });

        }


        var _onDataEvent = function (webClientMessage) {
            var payLoad = webClientMessage.payload;
            var lastUpdate = webClientMessage.localeTimeString();
            var isInitialLoad = webClientMessage.isInitialTopicLoad();
            var header = webClientMessage.getHeader();
            var topic = webClientMessage.topic;

            var _regexArray = gecPrivate._regexArray;
            for (var i = 0; i < _regexArray.length; i++) {
                var matches = _regexArray[i].regex.exec(topic); // /r?or?/g

                if (matches == null)
                    matches = _regexArray[i].regex.exec(header);

                if (matches != null) {
                    var bodyObject = {};

                    var numberOfFields = webClientMessage.getNumberOfRecords();
                    for (var f = 0; f < numberOfFields; f++) {
                        var rowData = webClientMessage.getFields(f);
                        if (_regexArray[i].converter == null) {
                            bodyObject[rowData[0]] = rowData[1];
                            if (rowData[0] === "0" || rowData[0] === "1") {//correlationIds or returncode
                                bodyObject[rowData[0]] = Number(rowData[1]);
                            }

                        }
                        else {
                            _convertBodyItem(bodyObject, rowData[0], rowData[1], _regexArray[i].converter);
                            if (bodyObject.returnCode !== undefined) {
                                bodyObject.returnCode = Number(bodyObject.returnCode);
                            }
                            if (bodyObject.correlationId !== undefined) {
                                bodyObject.correlationId = Number(bodyObject.correlationId);
                            }
                        }
                    }


                    return _regexArray[i].method.call(null, webClientMessage, matches, bodyObject);

                    break;// found one regex break out
                }
            }
            console.log("unknown message topic:" + webClientMessage.topic);
            alert("unknown message topic:" + webClientMessage.topic);
            return;
        }

        var loadedAlreadyFired = false;

        var _onSocketOpen = function (isConnected) {

            window.clearInterval(_pingHandle);
            stopPushHealthcheckTimer();

            if (isConnected) {
                gecPrivate._isConnecting = false;

                _pingHandle = window.setInterval(function () {
                    if (!gecPrivate._anonSet && (gecPrivate._aapiSessionToken == null)) return;

                    var curTime = new Date().toISOString();

                    if (gecPrivate._lastPingedAt === 0) {
                        gecPrivate._lastPingedAt = curTime;
                    }

                    _thisController.ping({
                        currentClientTime: curTime,
                        lastPingRoundtripMS: gecPrivate._lastPingRoundtripMS,
                        lastPingedAt: gecPrivate._lastPingedAt
                    });

                }, _pingInterval);

                if (_onControllerLoaded && !loadedAlreadyFired) {
                    loadedAlreadyFired = true;
                    _onControllerLoaded(false, null);
                }
            }
        };

        var _onSocketClose = function (onComplete) {

            if (_haveReceivedAtLeastOneStreamingMessage === false
                && params.onStreamingInitialisationFailed !== undefined) {

                // Socket has been closed while we are trying to initialise streaming
                // (as opposed to initialisation succeeding and messages received and 
                // then at some future point in time, the connection is dropped and the socket is closed)
                // and calling client has specified a callback for this situation

                // So call that callback...
                params.onStreamingInitialisationFailed.call(this);

                // ... and also call onComplete and _onControllerLoaded
                // so that client can proceed with bootstrapping and 
                // it may poll IAPI instead of using streaming

                if (onComplete) {
                    onComplete(true);
                }

                if (_onControllerLoaded && !loadedAlreadyFired) {
                    loadedAlreadyFired = true;
                    _onControllerLoaded(false, null);
                }

            } else {
                _onConnectionLost();
            }

        };

        var _onConnectionLost = function () {
            gecPrivate._anonSet = false;
            _connectionHealth = 0;
            resetFiredDelegates();

            if (_pingHandle != null)
                window.clearInterval(_pingHandle);

            stopPushHealthcheckTimer();

            if (_thisController.streamingConnectionDetails && params.onConnectionLost != null) {
                gecPrivate._isConnecting = true;
                params.onConnectionLost.call(this);
            }

        }

        var _createTopicMessageStr = function (tm) {
            var message = '';
            for (itemI in tm) {
                var value = (typeof tm[itemI] == "boolean") ? (tm[itemI] ? 'T' : 'F') : tm[itemI];
                message += itemI + "\u0002" + value + "\u0002" + "\u0001";
            }
            return message;
        }

        gecPrivate._sendStreamingMessage = function (headerName, request) {
            var message = _createTopicMessageStr(request);

            function sendRequest(id, message) {
                var request = "\u0002" + id + "\u0001" + message;
                socket.send(request);
                logConsole("socket sending... " + request);

            }
            sendRequest(headerName, message);
        };

        gecPrivate._sendStreamingMessageJSON = function (request) {
            logConsole("socket sending... " + JSON.stringify(request));
            socket.send(JSON.stringify(request));
        };

        var _onSetRefreshPeriod = function (webClientMessage, headerMatches, bodyObject) {

            var correlationId = bodyObject[0] * 1;
            var returnCode = bodyObject[1] * 1;

            gecPrivate.removeFromPushMessages(correlationId);

            if (returnCode != 0) {
                alert("error _onSetRefreshPeriod:" + returnCode);
            }

        };
        var _onGetRefreshPeriod = function (webClientMessage, headerMatches, bodyObject) {

            try {
                var correlationId = bodyObject[0] * 1;
                var returnCode = bodyObject[1] * 1;
                var refreshPeriodMS = bodyObject[2];

                gecPrivate.removeFromPushMessages(correlationId);

                if (returnCode != null) {
                    var response = { correlationId: correlationId };
                    if (refreshPeriodMS != null) response.refreshPeriodMS = refreshPeriodMS;

                    gecPrivate._correlationData[correlationId].callbackOnSuccess.call(this, response);
                }
                else {
                    gecPrivate._correlationData[correlationId].callbackOnException.call(this, new gec.AsyncException({ returnCode: returnCode, name: getReturnCodeName(returnCode) }));
                }

            } catch (e) {
                alert("_onGetRefreshPeriod error:" + e.message);
            }
        };

        this.setRefreshPeriod = function (params) {
            var correlationId = gecPrivate.addToCorrelation(params);

            var request = {};
            request[0] = correlationId;
            request[1] = params.refreshPeriodMS;

            gecPrivate.addToPushMessages(request);
            gecPrivate._sendStreamingMessage(60, request);
            return correlationId;
        };
        this.getRefreshPeriod = function (params) {
            var correlationId = gecPrivate.addToCorrelation(params);

            var request = {};
            request[0] = correlationId;

            gecPrivate.addToPushMessages(request);
            gecPrivate._sendStreamingMessage(61, request);
            return correlationId;
        };



        var _logonTelebetUser = function () {
            var correlationId = gecPrivate.addToCorrelation(params)

            gecPrivate._sendStreamingMessage(4, {
                0: correlationId,
                1: controllerDefaults.currency,
                2: controllerDefaults.language,
                3: controllerDefaults.priceFormat,
                4: false,
                5: controllerDefaults.integrationPartnerId,
                6: _aapiVersion,
                7: _createUUID()
            });

        }
        var _setPunterContext = function () {
            var correlationId = gecPrivate.addToCorrelation(params)

            gecPrivate._sendStreamingMessage(5, {
                0: correlationId,
                1: controllerDefaults.currency,
                2: controllerDefaults.language,
                3: controllerDefaults.priceFormat,
                4: 'F',
                5: controllerDefaults.integrationPartnerId,
                6: _aapiVersion,
                7: _createUUID()
            });

        }

        var _clearPunterContext = function () {
            var correlationId = gecPrivate.addToCorrelation(params)

            gecPrivate._sendStreamingMessage(6, {
                0: correlationId,
                1: controllerDefaults.currency,
                2: controllerDefaults.language,
                3: controllerDefaults.priceFormat,
                4: 'F',
                5: controllerDefaults.integrationPartnerId,
                6: _aapiVersion,
                7: _createUUID()
            });

        }

        var _logoffTelebetUser = function () {
            var correlationId = gecPrivate.addToCorrelation(params)

            gecPrivate._sendStreamingMessage(7, {
                0: correlationId,
                1: controllerDefaults.currency,
                2: controllerDefaults.language,
                3: controllerDefaults.priceFormat,
                4: 'F',
                5: controllerDefaults.integrationPartnerId,
                6: _aapiVersion,
                7: _createUUID()
            });

        }


        var _listOfFireOnSubscribedExchangeMarketIL = [];
        var _listOfFireOnSubscribedExchangeSelectionIL = [];
        var _listOfFireOnSubscribedMarketScoresIL = [];
        var _listOfFireOnITLCycleComplete = [];

        this.subscribeMarketInformation = function (params) {

            var correlationId = gecPrivate.addToCorrelation(params);
            var request = {};
            request[0] = correlationId;
            request[7] = params.fetchOnly;

            if (params.wantSelectionInformation !== undefined) {
                request[8] = params.wantSelectionInformation;
            }

            if (params.wantExchangeLangugeInformationOnly !== undefined) {
                request[9] = params.wantExchangeLangugeInformationOnly;
            }

            if (params.marketTaggedValueTopicNames !== undefined) {
                request[10] = params.marketTaggedValueTopicNames;
            }
            if (params.eventClassifierId !== undefined) {
                request[2] = '' + params.eventClassifierId;
                request[5] = true;
            }
            if (params.marketIds != undefined) {
                request[6] = '';
                for (marketI in params.marketIds) {
                    request[6] += params.marketIds[marketI] + '~';
                }
                request[6] = request[6].substr(0, request[6].length - 1);
            }

            request[12] = (params.wantSelectionBlurb !== undefined) ? params.wantSelectionBlurb : false;
            if (params.bettingTypeId !== undefined) {
                request[13] = params.bettingTypeId;
            }
            if (gecPrivate._debug) { gecPrivate._base.log('subscribeMarketInformation'); }
            gecPrivate._sendStreamingMessage(9, request);

            return correlationId;
        };

        gec.Controller.prototype.subscribeEventHierarchy = function (params) {
            if (!this.isStreamingEnabled) {
                window.setTimeout(params.callbackOnSuccess, 100);
                return;
            }
            var correlationId = gecPrivate.addToCorrelation(params);

            var request = {};
            request[0] = correlationId;

            if (params.eventClassifierId !== undefined) {
                request[2] = params.eventClassifierId;
            }

            request[3] = params.wantDirectDescendantsOnly;
            request[4] = params.wantSelectionInformation;
            request[5] = params.fetchOnly;
            if (params.eventTaggedValueTopicNames !== undefined) {
                request[9] = params.eventTaggedValueTopicNames;
            }
            if (params.marketTaggedValueTopicNames !== undefined) {
                request[10] = params.marketTaggedValueTopicNames;
            }
            request[11] = params.excludeMarketInformation;
            request[12] = params.wantTabInformation;
            request[14] = (params.wantSelectionBlurb !== undefined) ? params.wantSelectionBlurb : false;

            gecPrivate._sendStreamingMessage(12, request);
            return correlationId;
        }
        var _clientLogEntries = [];

        this.addClientLogEntry = function (params) {
            if ((_logClientEntries === true) || (_logClientEntries[params.componentName] === true)) {
                params.partnerUsername = (gecPrivate.userContext != null) ? gecPrivate.userContext.partnerUsername : undefined;

                if ((_logClientEntries["loggedInOnly"] !== true) || (params.partnerUsername !== undefined)) {
                    _clientLogEntries[_clientLogEntries.length] = params;
                }

            }
        }
        var getLogEntries = function () {
            var tempEntries = _clientLogEntries.slice(0);
            _clientLogEntries = [];
            if (tempEntries.length > 0) {
                return {
                    clientTimestamp: (new Date()).toISOString(),
                    events: tempEntries
                };

            } else {
                return undefined;
            }

        }
        var clearLogEntries = function () {
            _clientLogEntries = [];
        }



        /****************************
        addPunter
        ****************************/
        this.addPunter = function (params) {
            if (gecPrivate.userContext != null) {
                params.callbackOnException.call(this, { returnCode: 617 });
            }
            else {
                var request = new gec.IAPIRequest(params);
                request.integrationPartnerId = params.integrationPartnerId;
                request.partnerUsername = params.partnerUsername;
                request.cleartextPassword = params.cleartextPassword;
                request.passwordToken = params.passwordToken;
                request.title = params.title;
                request.sex = params.sex;
                request.name = params.name;
                request.country = params.country;
                request.address = params.address;
                request.email = params.email;
                request.phone = params.phone;
                request.secondaryPhone = params.secondaryPhone;

                request.firstQuestionType = params.firstQuestionType;
                request.firstQuestionAnswer = params.firstQuestionAnswer;
                request.secondQuestionType = params.secondQuestionType;
                request.secondQuestionAnswer = params.secondQuestionAnswer;
                request.birthDate = params.birthDate;
                request.isContactAllowed = params.isContactAllowed;
                request.contactType = params.contactTypeId;
                request.currency = params.currency;
                request.reference = params.reference;
                request.affiliateIdentifier = params.affiliateIdentifier;
                request.whiteLabel = params.whiteLabel;

                request.priceFormat = params.priceFormat;
                request.marketByVolumeAmount = { amount: params.marketByVolumeAmount, currency: params.currency };

                request.language = params.language;
                request.forOrderRepriceOption = params.forOrderRepriceOption;
                request.againstOrderRepriceOption = params.againstOrderRepriceOption;
                request.includeSettledSelectionsInPAndL = params.includeSettledSelectionsInPAndL;

                request.normalMaximumLiability = { amount: params.normalMaximumLiability, currency: params.currency };

                if (params.maxPunterReservationPerMarket != null)
                    request.maxPunterReservationPerMarket = { amount: params.maxPunterReservationPerMarket, currency: params.currency };

                request.debitSportsbookStake = params.debitSportsbookStake;
                request.debitExchangeStake = params.debitExchangeStake;

                this.sendRequest('/AddPunter.ashx', request, _addPunterResponse);
            }
        };
        var _addPunterResponse = function (request, response) {
            if (response.returnCode != 0) {
                request.callbackOnException.call(this, { returnCode: response.returnCode });
            } else {


                var userContext = null;

                gecPrivate.sessionToken = response.sessionToken;
                _telebetSessionToken = null;

                userContext = new gec.UserContext();
                userContext.partnerUsername = request.partnerUsername;
                userContext.debitSportsbookStake = request.debitSportsbookStake;
                userContext.debitExchangeStake = request.debitExchangeStake;
                userContext.purseIntegraionModeId = request.purseIntegrationMode;
                userContext.canPlaceForSideOrders = request.canPlaceForSideOrders;
                userContext.canPlaceAgainstSideOrders = request.canPlaceAgainstSideOrders;
                userContext.currency = request.currency;
                userContext.language = request.language;
                userContext.priceFormat = request.priceFormat;
                userContext.marketByVolumeAmount = request.marketByVolumeAmount;
                userContext.hasSubPunters = response.hasSubPunters;

                _username = request.partnerUsername;
                _password = request.cleartextPassword;
                gecPrivate.userContext = userContext;

                request.callbackOnSuccess.call(this, gecPrivate.userContext);
            }
        };
        /****************************
        addPunterEnhanced
        ****************************/
        this.addPunterEnhanced = function (params) {

            if (gecPrivate.userContext != null) {

                params.callbackOnException.call(this, new gec.AsyncException({ returnCode: 617 }));

            } else {

                if (params.cleartextPassword !== undefined
                    && this.checkPasswordValidity({ password: params.cleartextPassword }) === false) {

                    params.callbackOnException.call(this, { returnCode: 405 /* InvalidPassword */ });

                } else {

                    var request = new gec.IAPIRequest(params);

                    request.username = params.username;
                    request.cleartextPassword = params.cleartextPassword;
                    request.title = params.titleId;
                    request.sex = params.sexId;
                    request.name = params.name;
                    request.country = params.country;
                    request.address = params.address;
                    request.email = params.email;
                    request.phone = params.phone;
                    request.secondaryPhone = params.secondaryPhone;

                    request.priceFormat = params.priceFormat;
                    request.forOrderRepriceOption = params.forOrderRepriceOptionId;
                    request.againstOrderRepriceOption = params.againstOrderRepriceOptionId;
                    request.marketByVolumeAmount = { amount: params.marketByVolumeAmount, currency: params.currency };
                    request.includeSettledSelectionsInPAndL = params.includeSettledSelectionsInPAndL;

                    request.language = params.language;
                    request.firstQuestionType = params.firstQuestionTypeId;
                    request.firstQuestionAnswer = params.firstQuestionAnswer;
                    request.secondQuestionType = params.secondQuestionTypeId;
                    request.secondQuestionAnswer = params.secondQuestionAnswer;
                    request.birthDate = params.birthDate;
                    request.reference = params.reference;
                    request.isContactAllowed = params.isContactAllowed;
                    request.contactType = params.contactTypeId;
                    request.currency = params.currency;
                    request.affiliateIdentifier = params.affiliateIdentifier;
                    request.channelType = params.channelType;
                    request.depositLimit = params.depositLimit;

                    request.channelInformation = "-GEC" + _version.implementationVersion + "|" + params.channelInformation;
                    request.whiteLabel = params.whiteLabel;

                    request.punterIPAddress = params.punterIPAddress;
                    request.finalIPAddress = params.finalIPAddress;
                    request.fingerprint = params.fingerprint;

                    request.tmxSessionId = params.tmxSessionId;
                    request.tmxWebSessionId = params.tmxWebSessionId;
                    request.promoCode = params.promoCode;

                    this.sendRequest('/AddPunterEnhanced.ashx', request, _addPunterEnhancedResponse);
                }
            }
        };
        var _addPunterEnhancedResponse = function (request, response) {
            if (response.returnCode != 0) {
                request.callbackOnException.call(this, new gec.AsyncException({ returnCode: response.returnCode }));
            } else {
                request.callbackOnSuccess.call(this, response);
            }
        };
        /****************************
        enrolPunter
        ****************************/
        this.enrolPunter = function (params) {

            if (params.cleartextPassword !== undefined
                && this.checkPasswordValidity({ password: params.cleartextPassword }) === false) {

                params.callbackOnException.call(this, { returnCode: 405 /* InvalidPassword */ });

            } else {

                var request = new gec.IAPIRequest(params);

                if (gecPrivate.sessionToken != null) {
                    request.sessionToken = gecPrivate.sessionToken;
                } else {
                    request.username = params.username;
                    if (params.integrationPartnerId != null) {
                        request.integrationPartnerId = params.integrationPartnerId;
                        request.purseIntegrationMode = params.purseIntegrationMode;

                    }
                }

                request.cleartextPassword = params.cleartextPassword;
                request.title = params.titleId || params.title;
                request.sex = params.sexId || params.sex;
                request.name = params.name;
                request.country = params.country;
                request.address = params.address;
                request.email = params.email;
                request.phone = params.phone;
                request.secondaryPhone = params.secondaryPhone;


                request.firstQuestionType = params.firstQuestionTypeId || params.firstQuestionType;
                request.firstQuestionAnswer = params.firstQuestionAnswer;
                request.secondQuestionType = params.secondQuestionTypeId || params.secondQuestionType;
                request.secondQuestionAnswer = params.secondQuestionAnswer;
                request.birthDate = params.birthDate;
                request.isContactAllowed = params.isContactAllowed;
                request.contactType = params.contactTypeId || params.contactType;
                request.currency = params.currency;
                request.reference = params.reference;
                request.affiliateIdentifier = params.affiliateIdentifier;
                request.whiteLabel = params.whiteLabel;

                if (params.priceFormat != undefined)
                    request.priceFormat = params.priceFormat;

                if (params.marketByVolumeAmount != undefined)
                    request.marketByVolumeAmount = { amount: params.marketByVolumeAmount, currency: params.currency };

                request.language = params.language;

                if (params.forOrderRepriceOptionId != undefined) {
                    request.forOrderRepriceOption = params.forOrderRepriceOptionId;
                }

                if (params.forOrderRepriceOption != undefined) {
                    request.forOrderRepriceOption = params.forOrderRepriceOption;
                }

                if (params.againstOrderRepriceOptionId != undefined) {
                    request.againstOrderRepriceOption = params.againstOrderRepriceOptionId;
                }

                if (params.againstOrderRepriceOption != undefined) {
                    request.againstOrderRepriceOption = params.againstOrderRepriceOption;
                }

                if (params.includeSettledSelectionsInPAndL != undefined)
                    request.includeSettledSelectionsInPAndL = params.includeSettledSelectionsInPAndL;

                request.channelType = params.channelType;
                request.granularChannelType = params.granularChannelType;

                request.iPAddress = params.iPAddress;
                request.channelInformation = "-GEC" + _version.implementationVersion + "|" + params.channelInformation;

                request.reference = params.reference;
                request.whiteLabel = params.whiteLabel;
                request.punterTaggedValues = params.punterTaggedValues;
                request.affiliateIdentifier = params.affiliateIdentifier;
                request.fingerprint = params.fingerprint;
                request.tmxSessionId = params.tmxSessionId;
                request.tmxWebSessionId = params.tmxWebSessionId;

                this.sendRequest('/EnrolPunter.ashx', request, _enrolPunterResponse);

            }
        };
        var _enrolPunterResponse = function (request, response) {

            if (response.returnCode == gec.ReturnCode.Success
                || response.returnCode == gec.ReturnCode.PunterFailedIdentityVerificationCheck) {

                if (response.sessionToken != null) {
                    gecPrivate.sessionToken = response.sessionToken;
                    delete response.sessionToken;
                    if (gecPrivate.userContext != null && response.punterClassificationName !== undefined) {
                        gecPrivate.userContext.punterClassificationName = response.punterClassificationName;
                    }
                }

                request.callbackOnSuccess.call(this, response);
            } else {
                request.callbackOnException.call(this, response);
            }
        };

        /****************************
        continuePunterEnrolmentIAPI
        ****************************/
        this.continuePunterEnrolment = function (params) {

            if (params.cleartextPassword !== undefined
                && this.checkPasswordValidity({ password: params.cleartextPassword }) === false) {

                params.callbackOnException.call(this, { returnCode: 405 /* InvalidPassword */ });

            } else {

                var request = new gec.IAPIRequest(params);

                if (gecPrivate.sessionToken != null) {
                    request.sessionToken = gecPrivate.sessionToken;
                }

                request.enrolmentAttemptId = params.enrolmentAttemptId;
                request.enrolmentAttemptValidationToken = params.enrolmentAttemptValidationToken;
                request.quizId = params.quizId;
                request.questions = params.answers;

                if (params.cleartextPassword != undefined)
                    request.cleartextPassword = params.cleartextPassword;

                this.sendRequest('/ContinuePunterEnrolment.ashx', request, _continuePunterEnrolmentResponse);

            }
        };
        var _continuePunterEnrolmentResponse = function (request, response) {

            if (response.returnCode === 0) {
                if (response.sessionToken != null) {
                    gecPrivate.sessionToken = response.sessionToken;
                    gecPrivate.userContext.punterClassificationName = response.punterClassificationName;
                    delete response.sessionToken;
                }
                request.callbackOnSuccess.call(this, response);
            } else {
                request.callbackOnException.call(this, {
                    returnCode: response.returnCode
                });
            }
        };

        /****************************
        enrolPunterAsynchronously
        ****************************/
        this.enrolPunterAsynchronously = function (params) {

            if (params.cleartextPassword !== undefined
                && this.checkPasswordValidity({ password: params.cleartextPassword }) === false) {

                params.callbackOnException.call(this, { returnCode: gec.ReturnCode.InvalidPassword });

            } else {

                var request = new gec.IAPIRequest(params);

                if (gecPrivate.sessionToken != null) {
                    request.sessionToken = gecPrivate.sessionToken;
                } else {
                    request.username = params.username;
                    if (params.integrationPartnerId != null) {
                        request.integrationPartnerId = params.integrationPartnerId;
                        request.purseIntegrationMode = params.purseIntegrationMode;

                    }
                }

                request.cleartextPassword = params.cleartextPassword;
                request.title = params.title;
                request.sex = params.sex;
                request.name = params.name;
                request.country = params.country;
                request.address = params.address;
                request.email = params.email;
                request.phone = params.phone;
                request.secondaryPhone = params.secondaryPhone;

                request.firstQuestionType = params.firstQuestionType;
                request.firstQuestionAnswer = params.firstQuestionAnswer;
                request.secondQuestionType = params.secondQuestionType;
                request.secondQuestionAnswer = params.secondQuestionAnswer;
                request.birthDate = params.birthDate;
                request.isContactAllowed = params.isContactAllowed;
                request.contactType = params.contactType;
                request.currency = params.currency;
                request.reference = params.reference;
                request.affiliateIdentifier = params.affiliateIdentifier;
                request.whiteLabel = params.whiteLabel;

                if (params.priceFormat != undefined)
                    request.priceFormat = params.priceFormat;

                if (params.marketByVolumeAmount != undefined)
                    request.marketByVolumeAmount = { amount: params.marketByVolumeAmount, currency: params.currency };

                request.language = params.language;

                if (params.forOrderRepriceOption != undefined)
                    request.forOrderRepriceOption = params.forOrderRepriceOption;

                if (params.againstOrderRepriceOption != undefined)
                    request.againstOrderRepriceOption = params.againstOrderRepriceOption;

                if (params.includeSettledSelectionsInPAndL != undefined)
                    request.includeSettledSelectionsInPAndL = params.includeSettledSelectionsInPAndL;

                request.channelType = params.channelType;
                request.granularChannelType = params.granularChannelType;

                request.iPAddress = params.iPAddress;
                request.channelInformation = "-GEC" + _version.implementationVersion + "|" + params.channelInformation;

                request.reference = params.reference;
                request.whiteLabel = params.whiteLabel;
                request.punterTaggedValues = params.punterTaggedValues;
                request.affiliateIdentifier = params.affiliateIdentifier;

                request.responseEmailUrl = params.responseEmailUrl;
                request.aapiClientSpecifiedGuid = params.aapiClientSpecifiedGuid;
                request.correlationId = params.correlationId;

                this.sendRequest('/EnrolPunter.aspx', request, _asyncEnrolPunterResponse, undefined, undefined, true);
            }
        };
        var _asyncEnrolPunterResponse = function (request, response) {
            if (response.returnCode == gec.ReturnCode.Success) {
                request.callbackOnSuccess.call(this, response);
            } else {
                request.callbackOnException.call(this, response);
            }
        };

        this.checkEnrolmentStatus = function (params) {
            var request = new gec.IAPIRequest(params);
            request.enrolmentAttemptId = params.enrolmentAttemptId;
            request.enrolmentAttemptValidationToken = params.enrolmentAttemptValidationToken;
            this.sendRequest('/CheckEnrolmentStatus.ashx', request, _checkEnrolmentStatusResponse);
        };

        var _checkEnrolmentStatusResponse = function (request, response) {
            if (response.returnCode == gec.ReturnCode.Success
                || response.returnCode == gec.ReturnCode.PunterFailedIdentityVerificationCheck) {
                request.callbackOnSuccess.call(this, response);
            } else {
                request.callbackOnException.call(this, {
                    returnCode: response.returnCode
                });
            }
        };

        this.addConnectionHealthChangeDelegate = function (delegate, threshold) {
            var delId = gecPrivate._connectionHealthChangeDelegates.length;
            gecPrivate._connectionHealthChangeDelegates[delId] = delegate;
            return delId;
        };
        this.addSubscribedGTVILDelegate = function (delegate) {
            var delId = gecPrivate._subscribedGTVILDelegates.length;
            gecPrivate._subscribedGTVILDelegates[delId] = delegate;
            return delId;
        };
        this.addSubscribedExchangeMarketILDelegate = function (delegate) {
            var delId = gecPrivate._subscribedExchangeMarketILDelegates.length;
            gecPrivate._subscribedExchangeMarketILDelegates[delId] = delegate;
            return delId;
        };
        this.addSubscribedExchangeEventILDelegate = function (delegate) {
            var delId = gecPrivate._subscribedExchangeEventILDelegates.length;
            gecPrivate._subscribedExchangeEventILDelegates[delId] = delegate;
            return delId;
        };
        this.addSubscribedExchangeSelectionILDelegate = function (delegate) {
            var delId = gecPrivate._subscribedExchangeSelectionILDelegate.length;
            gecPrivate._subscribedExchangeSelectionILDelegate[delId] = delegate;
            return delId;
        };
        this.addSubscribedMarketScoresILDelegate = function (delegate) {
            var delId = gecPrivate._subscribedMarketScoresILDelegate.length;
            gecPrivate._subscribedMarketScoresILDelegate[delId] = delegate;
            return delId;
        };
        this.addSubscribedExchangeSelectionPricesILDelegate = function (delegate) {
            var delId = gecPrivate._subscribedExchangeSelectionPricesILDelegate.length;
            gecPrivate._subscribedExchangeSelectionPricesILDelegate[delId] = delegate;
            return delId;
        };
        this.addSubscribedExchangeSelectionFixedOddsPricesILDelegate = function (delegate) {
            var delId = gecPrivate._subscribedExchangeSelectionFixedOddsPricesILDelegate.length;
            gecPrivate._subscribedExchangeSelectionFixedOddsPricesILDelegate[delId] = delegate;
            return delId;
        };
        this.addSubscribedExchangeMarketMatchedAmountILDelegate = function (delegate) {
            var delId = gecPrivate._subscribedExchangeMarketMatchedAmountILDelegate.length;
            gecPrivate._subscribedExchangeMarketMatchedAmountILDelegate[delId] = delegate;
            return delId;
        };
        this.addSubscribedCardILDelegate = function (delegate) {
            var delId = gecPrivate._subscribedCardILDelegates.length;
            gecPrivate._subscribedCardILDelegates[delId] = delegate;
            return delId;
        };
        this.addSubscribedRaceILDelegate = function (delegate) {
            var delId = gecPrivate._subscribedRaceILDelegates.length;
            gecPrivate._subscribedRaceILDelegates[delId] = delegate;
            return delId;
        };
        this.addSubscribedRacePoolILDelegate = function (delegate) {
            var delId = gecPrivate._subscribedRacePoolILDelegates.length;
            gecPrivate._subscribedRacePoolILDelegates[delId] = delegate;
            return delId;
        };
        this.addSubscribedRunnerILDelegate = function (delegate) {
            var delId = gecPrivate._subscribedRunnerILDelegates.length;
            gecPrivate._subscribedRunnerILDelegates[delId] = delegate;
            return delId;
        };
        this.addSubscribedCTVILDelegate = function (delegate) {
            var delId = gecPrivate._subscribedCTVILDelegates.length;
            gecPrivate._subscribedCTVILDelegates[delId] = delegate;
            return delId;
        };
        this.addSubscribedRTVILDelegate = function (delegate) {
            var delId = gecPrivate._subscribedRTVILDelegates.length;
            gecPrivate._subscribedRTVILDelegates[delId] = delegate;
            return delId;
        };
        this.addSubscribedGTVILDelegate = function (delegate) {
            var delId = gecPrivate._subscribedGTVILDelegates.length;
            gecPrivate._subscribedGTVILDelegates[delId] = delegate;
            return delId;
        };
        this.addSubscribedAsyncResponseILDelegate = function (delegate) {
            var delId = gecPrivate._subscribedAsyncResponseILDelegates.length;
            gecPrivate._subscribedAsyncResponseILDelegates[delId] = delegate;
            return delId;
        };


        /************************************
        clearUserContext
        ************************************/
        this.clearUserContext = function () {
            if (_telebetSessionToken == null) {
                throw { "number": 588, "message": "NotTelebetUserSession" };
            }
            else {
                _clearUserContextVariables();
            }
        };
        var _clearUserContextVariables = function () {
            window.clearInterval(gecPrivate._orderCacheInterval);
            gecPrivate._orderCacheInterval = null;
            gecPrivate.userContext = null;
            gecPrivate.sessionToken = undefined;
            gecPrivate._orderCache = null; //non indexed
            gecPrivate._maxSequenceNo = 0;
        }

        this.endUserSession = function (request) {

            var terminateSessionRequest;

            if (gecPrivate.userContext === null) {
                throw { "number": 589, "message": "NotUserSession" };
            }
            else {

                // Call TerminateSession on IAPI
                terminateSessionRequest = new gec.IAPIRequest(null);
                terminateSessionRequest.sessionToken = gecPrivate.sessionToken;
                this.sendRequest('/TerminateSession.ashx', terminateSessionRequest, function () {
                    _params.isSessionPresent = false;
                    if (request && request.callbackOnSuccess) {
                        request.callbackOnSuccess.call(this, {});
                    }
                });

                // If storing session & userContext data in cookies, delete them
                if (_storeSessionTokenInCookieWithExpiryTime) {
                    gecPrivate._base.deleteCookie(sessionTokenCookieName);
                    gecPrivate._base.deleteCookie(gecPrivate.userContextCookieName);
                }

                // Clear context variables including session token
                _clearUserContextVariables();

                // Stop timer that extends session periodically
                window.clearInterval(_arbRefreshID);
            }

        };

        this.getCachedSubscribedExchangeMarket = function (marketId) {
            return gecPrivate._subscribedExchangeMarket[marketId];
        };

        this.getConnectionHealth = function () {
            return _connectionHealth;
        };
        this.listEventsStartingSoon = function (params) {
            if (1 == 2) {//todo
                throw { "number": 618, "message": "EventCacheNotPresent" };
            } else {
                var startTimeElapsedMSs = 43200000; //12 hours

                var elapsedTimeMSs = new Date().getTime() - startTimeElapsedMSs;
                var events = {};
                for (var j in gecPrivate._markets) {
                    if ((gecPrivate._base.jsDate(gecPrivate._markets[j].startTime) > elapsedTimeMSs) && !gecPrivate._markets[j].currentlyInRunning) {
                        var eventClassifierId = gecPrivate._markets[j].getEventClassifier().eventClassifierId;
                        events[eventClassifierId + gecPrivate._markets[j].startTime] = new gec.StartingSoonEvent(gecPrivate._markets[j]);
                    }
                }
                var eventsToReturn = [];
                for (ev in events) {
                    eventsToReturn[eventsToReturn.length] = events[ev];
                }
                eventsToReturn.sort(gec.SortOnStartingAt);

                return eventsToReturn;
            }
        };

        this.listInRunningEvents = function (params) {
            if (1 == 2) {//todo
                throw { "number": 618, "message": "EventCacheNotPresent" };
            } else {
                var events = {};

                for (var j in gecPrivate._markets) {
                    if (gecPrivate._markets[j].currentlyInRunning) {
                        var topLevelSport = new gec.InRunningSport(gecPrivate._markets[j].getEventClassifier(), gecPrivate._markets);
                        events[topLevelSport.getEventClassifier().eventClassifierId] = topLevelSport;
                    }
                }

                var eventsToReturn = [];

                for (ev in events) {
                    eventsToReturn[eventsToReturn.length] = events[ev];
                }

                return eventsToReturn;
            }
        };
        /****************************
        performCustomService
        ****************************/
        this.performCustomService = function (params) {
            var request = new gec.IAPIRequest(params);

            var customServicesThatDontRequireSessionToken = [
                "nyra.IsLocationRequiredForEstablishSession",
                "IsUsernameAlreadyUsed",
                "NYRA.ResendEmail",
                "EnterOntrackADWContest"
            ];

            // While some custom services should never need to be invoked when you already have a session,
            // it is possible for a client to do this. So we prevent a sessionToken ever being sent on an
            // IAPI call to such a custom service, as it can cause issues in the back-end.
            if (customServicesThatDontRequireSessionToken.includes(params.customServiceName)) {
                if (gecPrivate.sessionToken) {
                    console.error("The custom service " + params.customServiceName + " is being called when a GEC session already exists, which should not happen.");
                }
            } else {
                request.sessionToken = gecPrivate.sessionToken;
            }

            if (gecPrivate.userContext !== null) {
                request.language = gecPrivate.userContext.language;
            }
            else //use default
            {
                request.language = controllerDefaults.language;
            }

            request.integrationPartnerId = controllerDefaults.integrationPartnerId;
            request.customServiceName = params.customServiceName;
            request.nameValuePairs = params.nameValuePairs;
            request.existingCleartextPassword = params.existingCleartextPassword;
            request.isLoginAfterSuccessfulRegistration = params.isLoginAfterSuccessfulRegistration;

            this.sendRequest('/PerformCustomService.ashx', request, _performCustomServiceResponse);
        };
        var _performCustomServiceResponse = function (request, response) {

            if (response.returnCode != 0) {
                var message = response.customServiceHandlerError;
                if (response.nameValuePairs !== undefined && response.nameValuePairs.length) {
                    message = response.nameValuePairs[0].value;
                }
                request.callbackOnException.call(this, {
                    returnCode: response.returnCode,
                    customServiceHandlerError: response.customServiceHandlerError,
                    message: message,
                    nameValuePairs: response.nameValuePairs
                });
            } else {
                var items = response.nameValuePairs;

                request.callbackOnSuccess.call(this, { nameValuePairs: items });
            }
        };
        /*****************************
         * list tagged value IAPI call
         ******************************/

        this.listTaggedValues = function (params) {
            var request = new gec.IAPIRequest(params);
            request.sessionToken = gecPrivate.sessionToken;
            request = gecPrivate._base.extend(request, params);
            this.sendRequest('/ListTaggedValues.ashx', request, _listTaggedValuesResponse);
        };
        var _listTaggedValuesResponse = function (request, response) {
            if (response.returnCode != 0) {
                request.callbackOnException.call(this, { returnCode: response.returnCode });
            } else {
                request.callbackOnSuccess.call(this, {
                    entities: response.taggedValues
                });
            }
        };

        /*****************************
         * ListExchangeTaggedValues call
         ******************************/

        this.listExchangeTaggedValues = function (params) {
            var request = new gec.IAPIRequest(params);
            request.sessionToken = gecPrivate.sessionToken;
            request = gecPrivate._base.extend(request, params);
            this.sendRequest('/ListExchangeTaggedValues.ashx', request, _listExchangeTaggedValuesResponse);
        };
        var _listExchangeTaggedValuesResponse = function (request, response) {
            if (response.returnCode != 0) {
                request.callbackOnException.call(this, { returnCode: response.returnCode });
            } else {
                request.callbackOnSuccess.call(this, {
                    entities: response.taggedValues
                });
            }
        };

        /*****************************
         * getStartingPrices 
         ******************************/

        this.getStartingPrices = function (params) {
            var request = new gec.IAPIRequest(params);
            request = gecPrivate._base.extend(request, params);
            this.sendRequest('/GetStartingPrices.ashx', request, _getStartingPricesResponse);
        };

        var _getStartingPricesResponse = function (request, response) {
            if (response.returnCode != 0) {
                request.callbackOnException.call(this, { returnCode: response.returnCode });
            } else {
                request.callbackOnSuccess.call(this, {
                    entities: response.taggedValues
                });
            }
        };
        /****************************
        listCustomMarkets
        ****************************/
        this.listCustomMarkets = function (params) {
            var request = new gec.IAPIRequest(params);
            if (gecPrivate.sessionToken != null)
                request.sessionToken = gecPrivate.sessionToken;
            else {
                request.integrationPartnerId = controllerDefaults.integrationPartnerId;
                request.language = controllerDefaults.language;
            }
            request.customMarketListHandlerName = params.customMarketListHandlerName;
            request.customParameters = params.customParameters;

            this.sendRequest('/ListCustomMarkets.ashx', request, _listCustomMarketsResponse);
        };
        var _listCustomMarketsResponse = function (request, response) {
            if (response.returnCode != 0) {
                request.callbackOnException.call(this, { returnCode: response.returnCode });
            } else {


                request.callbackOnSuccess.call(this, { customMarkets: response.results });
            }
        };


        /****************************
        getAccountSummary
        ****************************/
        this.getAccountSummary = function (params) {

            var request;

            if (gecPrivate.userContext === null) {
                params.callbackOnException.call(this, { returnCode: 590, message: "NeitherUserNorTelebetUserSession" });
            } else {
                request = new gec.IAPIRequest(params);
                request.sessionToken = gecPrivate.sessionToken;

                this.sendRequest('/GetAccountSummary.ashx', request, _getAccountSummaryResponse);
            }
        };
        var _getAccountSummaryResponse = function (request, response) {
            if (response.returnCode != 0) {
                request.callbackOnException.call(this, { returnCode: response.returnCode });
            } else {
                request.callbackOnSuccess.call(this, response);
            }
        };

        this.listMarketsStartingSoonIAPIAsync = function (params) {
            if (controllerDefaults == null) {
                params.callbackOnException.call(this, { returnCode: 591, message: 'DefaultsNotLoaded' });;
            }
            else {
                var request = new gec.IAPIRequest(params);

                request.sessionToken = gecPrivate.sessionToken;
                request.playMarkets = params.playMarkets;
                request.wantPricedMarketsOnly = params.wantPricedMarketsOnly;

                if (gecPrivate.userContext !== null) {
                    request.integrationPartnerId = gecPrivate.userContext.integrationPartnerId;
                    request.language = gecPrivate.userContext.language;
                }
                else //use defaults
                {
                    request.integrationPartnerId = controllerDefaults.integrationPartnerId;
                    request.language = controllerDefaults.language;
                }

                this.sendRequest('/ListMarketsStartingSoon.ashx', request, listMarketsStartingSoonIAPIAsyncResponse);
            }

        };
        var listMarketsStartingSoonIAPIAsyncResponse = function (request, response) {
            if (response.returnCode != 0) {
                request.callbackOnException.call(this, { returnCode: response.returnCode, message: getReturnCodeName(response.returnCode) });
            } else {

                response.events = response.eventClassifiers;
                delete response.eventClassifiers;
                delete response.returnCode;

                request.callbackOnSuccess.call(this, response);
            }
        };
        this.listInRunningMarketsIAPIAsync = function (params) {
            if (controllerDefaults == null) {
                params.callbackOnException.call(this, { returnCode: 591, message: 'DefaultsNotLoaded' });
            }
            else {
                var request = new gec.IAPIRequest(params);

                request.sessionToken = gecPrivate.sessionToken;
                request.playMarkets = params.playMarkets;
                request.wantPricedMarketsOnly = params.wantPricedMarketsOnly;

                if (gecPrivate.userContext !== null) {
                    request.integrationPartnerId = gecPrivate.userContext.integrationPartnerId;
                    request.language = gecPrivate.userContext.language;
                }
                else //use defaults
                {
                    request.integrationPartnerId = controllerDefaults.integrationPartnerId;
                    request.language = controllerDefaults.language;
                }

                this.sendRequest('/ListInRunningMarkets.ashx', request, listInRunningMarketsIAPIAsyncResponse);
            }

        };
        var listInRunningMarketsIAPIAsyncResponse = function (request, response) {
            if (response.returnCode != 0) {
                request.callbackOnException.call(this, { returnCode: response.returnCode, message: getReturnCodeName(response.returnCode) });
            } else {
                delete response.returnCode;

                request.callbackOnSuccess.call(this, response);
            }
        };

        /************************************
        oddsLadder
        ************************************/
        this.oddsLadder = function () {
            return _oddsLadder;
        };

        this.ping = function (params) {
            var correlationId = gecPrivate.addToCorrelation(params)

            var request = {};
            request[0] = correlationId;
            if (params.currentClientTime != null)
                request[1] = params.currentClientTime;
            if (params.lastPingRoundtripMS != null)
                request[2] = params.lastPingRoundtripMS;
            if (params.lastPingedAt != null)
                request[3] = params.lastPingedAt;

            gecPrivate.addToPushMessages(request);
            gecPrivate._sendStreamingMessage(22, request);

            return correlationId;
        };

        this.reestablishConnection = function (params) {
            var correlationId = gecPrivate.addToCorrelation(params)

            if (_pingHandle != null) {
                window.clearInterval(_pingHandle);
            }

            stopPushHealthcheckTimer();

            if (_thisController.streamingConnectionDetails && _thisController.streamingConnectionDetails.sockURL !== undefined) {

                connect(_thisController.streamingConnectionDetails.sockURL, function (isConnected) {

                    window.clearInterval(_pingHandle);
                    stopPushHealthcheckTimer();

                    if (isConnected) {
                        gecPrivate._isConnecting = false;

                        if (gecPrivate._aapiSessionToken != null) {
                            _thisController.logonPunter({
                                channelInformation: params.channelInformation,
                                clientIdentifier: params.clientIdentifier,
                                callbackOnSuccess: function (response) {
                                    params.callbackOnSuccess(null, { correlationId: correlationId });
                                },
                                callbackOnException: function (response) {
                                    params.callbackOnException(null, { correlationId: correlationId, exception: new gec.AsyncException(response) });
                                },
                                aAPISessionToken: gecPrivate._aapiSessionToken
                            })

                        } else {

                            params.callbackOnSuccess.call(null, { correlationId: correlationId });
                        }

                        _pingHandle = window.setInterval(function () {
                            if (!gecPrivate._anonSet && (gecPrivate._aapiSessionToken == null)) return;

                            var curTime = new Date().toISOString();

                            if (gecPrivate._lastPingedAt === 0) {
                                gecPrivate._lastPingedAt = curTime;
                            }

                            _thisController.ping({
                                currentClientTime: curTime,
                                lastPingRoundtripMS: gecPrivate._lastPingRoundtripMS,
                                lastPingedAt: gecPrivate._lastPingedAt
                            });

                        }, _pingInterval);

                    } else {
                        params.callbackOnException.call(null, { correlationId: correlationId, exception: new gec.AsyncException({ returnCode: 1 }) });
                    }

                    gecPrivate.clientLogger.logClientEntry({
                        clientLogEntryType: 3,
                        componentName: "application",
                        subcomponentName: "sockjs",
                        logEntry: isConnected ? "SOCKJS: reestablishConnection Connected" : "SOCKJS: reestablishConnection failed"
                    });

                },
                    _thisController.streamingConnectionDetails.options || _thisController.streamingConnectionDetails.transports);
            }



        };

        this.removeConnectionHealthChangeDelegate = function (delegateIndex) {
            delete gecPrivate._connectionHealthChangeDelegates[delegateIndex];
        };
        this.removeSubscribedExchangeEventILDelegate = function (delegateIndex) {
            delete gecPrivate._subscribedExchangeEventILDelegates[delegateIndex];
        };
        this.removeSubscribedGTVILDelegate = function (delegateIndex) {
            delete gecPrivate._subscribedGTVILDelegates[delegateIndex];
        };
        this.removeSubscribedExchangeMarketILDelegate = function (delegateIndex) {
            delete gecPrivate._subscribedExchangeMarketILDelegates[delegateIndex];
        };
        this.removeSubscribedExchangeSelectionILDelegate = function (delegateIndex) {
            delete gecPrivate._subscribedExchangeSelectionILDelegate[delegateIndex];
        };
        this.removeSubscribedMarketScoresILDelegate = function (delegateIndex) {
            delete gecPrivate._subscribedMarketScoresILDelegate[delegateIndex];
        };
        this.removeSubscribedExchangeSelectionPricesILDelegate = function (delegateIndex) {
            delete gecPrivate._subscribedExchangeSelectionPricesILDelegate[delegateIndex];
        };
        this.removeSubscribedExchangeSelectionFixedOddsPricesILDelegate = function (delegateIndex) {
            delete gecPrivate._subscribedExchangeSelectionFixedOddsPricesILDelegate[delegateIndex];
        };
        this.removeSubscribedExchangeMarketMatchedAmountILDelegate = function (delegateIndex) {
            delete gecPrivate._subscribedExchangeMarketMatchedAmountILDelegate[delegateIndex];
        };
        this.removeSubscribedCardILDelegate = function (delegateIndex) {
            delete gecPrivate._subscribedCardILDelegates[delegateIndex];
        };
        this.removeSubscribedRaceILDelegate = function (delegateIndex) {
            delete gecPrivate._subscribedRaceILDelegates[delegateIndex];
        };
        this.removeSubscribedRacePoolILDelegate = function (delegateIndex) {
            delete gecPrivate._subscribedRacePoolILDelegates[delegateIndex];
        };
        this.removeSubscribedRunnerILDelegate = function (delegateIndex) {
            delete gecPrivate._subscribedRunnerILDelegates[delegateIndex];
        };
        this.removeSubscribedCTVILDelegate = function (delegateIndex) {
            delete gecPrivate._subscribedCTVILDelegates[delegateIndex];
        };
        this.removeSubscribedRTVILDelegate = function (delegateIndex) {
            delete gecPrivate._subscribedRTVILDelegates[delegateIndex];
        };
        this.removeSubscribedGTVILDelegate = function (delegateIndex) {
            delete gecPrivate._subscribedGTVILDelegates[delegateIndex];
        };
        this.removeSubscribedAsyncResponseILDelegate = function (delegateIndex) {
            delete gecPrivate._subscribedAsyncResponseILDelegates[delegateIndex];
        };


        gecPrivate._anonSet = false;

        this.getContestCards = function () {
            return gecPrivate.contestCards;
        }

        this.getContestPoolsForCard = function (shortCardName, cardDate) {

            var contestPools;

            if (gecPrivate.contestCards) {
                gecPrivate.contestCards.forEach(function (contestCard) {
                    if (contestCard.shortCardName === shortCardName
                        && contestCardDateMatchesCardDate(contestCard.cardDate, cardDate)) {
                        contestPools = contestCard.pools.split(",");
                    }
                });
            }

            return contestPools;
        }

        this.setDefaultValues = function (params) {

            controllerDefaults.language = params.language;

            if (params.integrationPartnerId != null) {
                controllerDefaults.integrationPartnerId = params.integrationPartnerId;
            }
            controllerDefaults.currency = params.currency;
            if (params.organisationalUnitId != null) {
                controllerDefaults.organisationalUnitId = params.organisationalUnitId;
            }

            controllerDefaults.priceFormat = params.priceFormat;

            if (params.isSessionPresent != undefined) {
                _params.isSessionPresent = params.isSessionPresent;
            }
            if (params.clientIdentifier !== undefined) {
                gecPrivate._GBEHeader.clientIdentifier = params.clientIdentifier.replace("{gecversion}", _version.implementationVersion);
            }
        };

        // Override the pushHealthcheck the user's values from the app
        this.setPersonalPushHealthcheckValues = function (params) {
            _pushHealthcheck.user = {};
            if (params.enabled) {
                _pushHealthcheck.user.enabled = params.enabled
            }
            if (params.timeout) {
                _pushHealthcheck.user.timeout = params.timeout
            }
            if (params.interval) {
                _pushHealthcheck.user.interval = params.interval
            }
        };

        /****************************
        setUserContext
        ****************************/
        this.setUserContext = function (params) {
            if (_telebetSessionToken == null) {
                params.callbackOnException.call(this, { returnCode: 588, message: 'NotTelebetUserSession' });
            }
            else {
                var request = new gec.IAPIRequest(params);
                request.telebetSessionToken = _telebetSessionToken;
                request.partnerUsername = params.partnerUsername;
                request.currency = params.currency;
                request.language = params.language;
                request.clientIdentifier = params.clientIdentifier;

                request.initialLanguage = params.initialLanguage;
                request.numberLogonAttemptsToReturn = params.numberLogonAttemptsToReturn;
                request.granularChannelType = params.granularChannelType;
                request.channelInformation = params.channelInformation;
                request.fingerprint = params.fingerprint;

                this.sendRequest('/EstablishSession.ashx', request, _setUserContextResponse);
            }
        };
        var _setUserContextResponse = function (request, response) {

            var userContext = null;
            if (response.returnCode != 0) {
                request.callbackOnException.call(this, {});
            } else {
                gecPrivate.sessionToken = response.sessionToken;

                userContext = new gec.UserContext();

                userContext.partnerUsername = request.partnerUsername;
                userContext.punterId = response.punterId;
                userContext.debitSportsbookStake = response.debitSportsbookStake;
                userContext.debitExchangeStake = response.debitExchangeStake;
                userContext.purseIntegraionModeId = response.purseIntegrationMode;
                userContext.canPlaceForSideOrders = response.canPlaceForSideOrders;
                userContext.canPlaceAgainstSideOrders = response.canPlaceAgainstSideOrders;
                userContext.canDeposit = response.canDeposit;
                userContext.canWithdraw = response.canWithdraw;
                userContext.canPlaceOrders = response.canPlaceOrders;
                userContext.cohort = response.cohort;
                userContext.restrictedToFillKillOrders = response.restrictedToFillKillOrders;
                userContext.currency = response.currency;
                userContext.language = response.language;
                userContext.priceFormat = response.priceFormat;
                userContext.marketByVolumeAmount = response.marketByVolumeAmount;
                userContext.integrationPartnerId = response.integrationPartnerId;
                userContext.aDWPointsEarned = response.aDWPointsEarned;
                userContext.isOnLegacyRegime = response.isOnLegacyRegime;
                userContext.whiteLabel = response.whiteLabel;
                userContext.isIdentityEstablished = response.isIdentityEstablished;
                userContext.isASubPunter = response.isASubPunter;
                userContext.hasSubPunters = response.hasSubPunters;

                gecPrivate.userContext = userContext;
                request.callbackOnSuccess.call(this, userContext);
            }


        };



        this.transferFromSportsbook = function (params) {
            if (gecPrivate.userContext == null) {
                params.callbackOnException.call(this, { returnCode: 591 });
            }
            else {
                var request = new gec.IAPIRequest(params);
                request.sessionToken = gecPrivate.sessionToken;
                request.amount = { 'amount': params.amount, 'currency': gecPrivate.userContext.currency };

                this.sendRequest('/TransferFromSportsbook.ashx', request, _transferFromSportsbookResponse);
            }
        };
        var _transferFromSportsbookResponse = function (request, response) {

            if (response.returnCode != 0) {
                request.callbackOnException.call(this, new gec.AsyncException(response));
            }
            else {
                request.callbackOnSuccess.call(this, response);
            }

        };
        this.transferToSportsbook = function (params) {
            if (gecPrivate.userContext == null) {
                params.callbackOnException.call(this, { returnCode: 591 });
            }
            else {
                var request = new gec.IAPIRequest(params);
                request.sessionToken = gecPrivate.sessionToken;
                request.amount = { 'amount': params.amount, 'currency': gecPrivate.userContext.currency };

                this.sendRequest('/TransferToSportsbook.ashx', request, _transferToSportsbookResponse);
            }
        };
        var _transferToSportsbookResponse = function (request, response) {
            if (response.returnCode != 0) {
                request.callbackOnException.call(this, new gec.AsyncException(response));
            }
            else {
                request.callbackOnSuccess.call(this, response);
            }
        };

        this.checkPasswordValidity = function (params) {

            // If no regular expression set, all passwords are valid
            if (gecPrivate.passwordValidityRegExp === undefined) {
                return true;
            }

            // Check against regular expression
            if (new RegExp(gecPrivate.passwordValidityRegExp).exec(params.password) !== null) {
                return true;
            }

            return false;
        }

        this.updatePunterDetails = function (params) {
            if (gecPrivate.userContext == null) {

                params.callbackOnException.call(this, { returnCode: 591 });

            }
            else {

                if (params.cleartextPassword !== undefined
                    && this.checkPasswordValidity({ password: params.cleartextPassword }) === false) {

                    params.callbackOnException.call(this, { returnCode: 405 /* InvalidPassword */ });

                } else {

                    var request = new gec.IAPIRequest(params);
                    request.sessionToken = gecPrivate.sessionToken;
                    request.newUsername = params.newUsername;
                    request.cleartextPassword = params.cleartextPassword;
                    request.existingCleartextPassword = params.existingCleartextPassword;

                    request.passwordToken = params.passwordToken;
                    request.title = params.title;
                    request.sex = params.sex;
                    request.name = params.name;
                    request.nameSpecified = params.nameSpecified;
                    request.country = params.country;
                    request.countrySpecified = params.countrySpecified,
                        request.address = params.address;
                    request.addressSpecified = params.addressSpecified;
                    request.email = params.email;
                    request.emailSpecified = params.emailSpecified;
                    request.phone = params.phone;
                    request.phoneSpecified = params.phoneSpecified;
                    request.secondaryPhone = params.secondaryPhone;
                    request.secondaryPhoneSpecified = params.secondaryPhoneSpecified
                    request.firstQuestionType = params.firstQuestionType;
                    request.firstQuestionAnswer = params.firstQuestionAnswer;
                    request.firstQuestionAnswerSpecified = params.firstQuestionAnswerSpecified;
                    request.secondQuestionType = params.secondQuestionType;
                    request.secondQuestionAnswer = params.secondQuestionAnswer;
                    request.secondQuestionAnswerSpecified = params.secondQuestionAnswerSpecified;
                    request.birthDate = params.birthDate;
                    request.birthDateSpecified = params.birthDateSpecified;
                    request.isContactAllowed = params.isContactAllowed;
                    request.isContactAllowedSpecified = params.isContactAllowedSpecified;
                    request.contactType = params.contactTypeId;

                    this.sendRequest('/UpdatePunterDetails.ashx', request, _updatePunterDetailsResponse);
                }
            }
        };
        var _updatePunterDetailsResponse = function (request, response) {
            if (response.returnCode != 0) {
                request.callbackOnException.call(this, new gec.AsyncException(response));
            }
            else {

                // If a new sessionToken was returned (which happens if username is changed)
                // then replace old sessionToken with new one
                if (response.sessionToken) {
                    gecPrivate.sessionToken = response.sessionToken;
                }

                request.callbackOnSuccess.call(this, {});
            }
        };
        /****************************
        updatePunterPreferences
        ****************************/
        this.updatePunterPreferences = function (params) {
            if (gecPrivate.userContext == null) {
                params.callbackOnException.call(this, { returnCode: 590, message: "NeitherUserNorTelebetUserSession" });
            }
            else {
                var request = new gec.IAPIRequest(params);

                request.sessionToken = gecPrivate.sessionToken;
                if (params.priceFormat != null) {
                    request.priceFormat = params.priceFormat;
                    request.priceFormatSpecified = true;

                    // Update user context...
                    gecPrivate.userContext.priceFormat = params.priceFormat;
                    // ...and save it to a cookie
                    if (_storeSessionTokenInCookieWithExpiryTime && (gecPrivate.sessionToken != null))
                        extendLifeOfSessionTokenCookie();
                }
                if (params.marketByVolumeAmount != null) {
                    request.marketByVolumeAmount = { amount: params.marketByVolumeAmount, currency: gecPrivate.userContext.currency };
                }
                if (params.language != null) {
                    request.language = params.language;
                    request.languageSpecified = true;
                }
                if (params.forOrderRepriceOption != null) {
                    request.forOrderRepriceOption = params.forOrderRepriceOption;
                    request.forOrderRepriceOptionSpecified = true;
                }
                if (params.againstOrderRepriceOption != null) {
                    request.againstOrderRepriceOption = params.againstOrderRepriceOption;
                    request.againstOrderRepriceOptionSpecified = true;
                }
                if (typeof params.includeSettledSelectionsInPAndL != 'undefined') {
                    request.includeSettledSelectionsInPAndL = params.includeSettledSelectionsInPAndL;
                    request.includeSettledSelectionsInPAndLSpecified = true;
                }
                if (params.normalMaximumLiability === null) {
                    request.normalMaximumLiability = {
                        amount: 0,
                        currency: gecPrivate.userContext.currency
                    };
                }
                else {
                    request.normalMaximumLiability = {
                        amount: params.normalMaximumLiability,
                        currency: gecPrivate.userContext.currency
                    };
                }

                if (params.maxPunterReservationPerMarket != null) {
                    request.maxPunterReservationPerMarketSpecified = true;
                    if (params.maxPunterReservationPerMarket != 'UnSet')
                        request.maxPunterReservationPerMarket = { amount: params.maxPunterReservationPerMarket, currency: gecPrivate.userContext.currency };
                    else
                        request.maxPunterReservationPerMarket = null;
                }

                this.sendRequest('/UpdatePunterPreferences.ashx', request, _updatePunterPreferencesResponse);
            }
        };
        var _updatePunterPreferencesResponse = function (request, response) {
            if (response.returnCode == 0) {
                if (request.priceFormat != null)
                    gecPrivate.userContext.priceFormat = request.priceFormat;

                if (request.language != null)
                    gecPrivate.userContext.language = request.language;

                gecPrivate.sessionToken = response.sessionToken;

                request.callbackOnSuccess.call(this, {});
            }
            else {
                request.callbackOnException.call(this, { returnCode: response.returnCode });
            }

        };
        this.getUserContext = function () {
            return gecPrivate.userContext;
        }

        this.getJSONWebToken = function (params) {
            var request = new gec.IAPIRequest(params);
            var thisGEC = this;
            request.sessionToken = gecPrivate.sessionToken;
            thisGEC.sendRequest('/GetJSONWebToken.ashx', request, _getJSONWebTokenResponse);
        }

        function _getJSONWebTokenResponse(request, response) {
            if (response.returnCode === 0) {
                request.callbackOnSuccess.call(this, response.jSONWebToken);
            } else {
                request.callbackOnException.call(this);
            }
        }

        /****************************
        establishUserSession 
        ****************************/

        this.establishUserSession = function (params) {

            var requiredParams = {
                initialLanguage: "en",
                numberLogonAttemptsToReturn: 1,
                granularChannelType: 1,
                channelInformation: ""
            };

            var request = new gec.IAPIRequest(params, requiredParams);
            var thisGEC = this;

            if (params.refreshSessionToken === true) {

                if (gecPrivate.userContext == null) {
                    params.callbackOnException.call(this, {
                        returnCode: gec.ReturnCode.NeitherUserNorTelebetUserSession
                    });
                    return;
                }
                request.sessionToken = gecPrivate.sessionToken;
                request.refreshSessionToken = params.refreshSessionToken;

            } else if (params.jSONWebToken !== undefined) {

                request.jSONWebToken = params.jSONWebToken;

            } else if (params.partnerToken != null) {

                request.partnerToken = params.partnerToken;
                try {
                    request.partnerUsernameForUserContext = JSON.parse(window.atob(params.partnerToken)).partnerUsername;
                } catch (ex) {
                    console.error("Exception parsing partnerToken");
                    console.error(params.partnerToken);
                    console.error(ex);
                }

            } else if ((params.cleartextPassword != null) || (params.passwordToken != null)) {

                request.partnerUsername = params.partnerUsername;
                request.cleartextPassword = params.cleartextPassword;
                request.passwordToken = params.passwordToken;
                request.currency = controllerDefaults.currency;
                request.integrationPartnerId = params.integrationPartnerId;

            } else {

                request.integrationPartnerId = controllerDefaults.integrationPartnerId;
                request.arbitrarySessionInformation = params.arbitrarySessionInformation;

            }

            request.language = controllerDefaults.language;
            request.clientIdentifier = params.clientIdentifier;
            request.granularChannelType = params.granularChannelType;
            request.channelInformation = params.channelInformation;
            request.finalIPAddress = params.finalIPAddress;
            request.initialLanguage = params.initialLanguage;
            request.numberLogonAttemptsToReturn = params.numberLogonAttemptsToReturn;
            request.twoFactorAuthenticationCode = params.twoFactorAuthenticationCode;
            request.trustedDeviceToken = params.trustedDeviceToken;
            request.reCAPTCHAToken = params.reCAPTCHAToken;
            request.tmxSessionId = params.tmxSessionId;
            request.tmxWebSessionId = params.tmxWebSessionId;
            request.tmxPageId = params.tmxPageId;

            request.fingerprint = params.fingerprint;
            request.location = params.location;
            request.callbackOnQueueingOfRequest = params.callbackOnQueueingOfRequest;
            request.geoLocationToken = params.geoLocationToken;

            if (params.requestLocationInformation) {

                this.getBrowserGeoLocation(function (location) {

                    if (location) {
                        request.location = {};
                        request.location.latitude = location.latitude;
                        request.location.longitude = location.longitude;
                        request.location.accuracy = Math.round(location.accuracy);

                        thisGEC.sendRequest('/EstablishSession.ashx', request, _establishUserSessionResponse);
                    } else {
                        request.callbackOnException.call(this, new gec.AsyncException({
                            returnCode: gec.ReturnCode.LocationNotSpecified,
                            name: getReturnCodeName(gec.ReturnCode.LocationNotSpecified)
                        }));
                    }

                });

            } else {

                thisGEC.sendRequest('/EstablishSession.ashx', request, _establishUserSessionResponse);

            }
        };

        gecPrivate.getListOfContestCardsForPunter = function (punterId, callbackOnSuccess, callbackOnException) {
            _thisController.listPunterTaggedValues({
                searchCriteria: "GEC.Contest." + punterId + ".%",
                callbackOnSuccess: function (contestPunterPTVs) {

                    if (contestPunterPTVs !== undefined
                        && contestPunterPTVs.length > 0) {

                        // Punter is enrolled in 1 or more contests.

                        // Look for contest GTVs with matching names
                        // (strip punterId from above PTV name(s) to get form "GEC.Contest.<contestName>")
                        _thisController.listGenericTaggedValues({

                            searchStrings: gecPrivate._base.getArrayOfTaggedValueNames(contestPunterPTVs).map(function (gtvName) {
                                return gtvName.replace("." + punterId, "");
                            }),

                            callbackOnSuccess: function (contestGenericTaggedValues) {

                                var now = new Date();

                                gecPrivate.contestCards = gecPrivate._base.getCardsForCurrentlyActiveContest(contestGenericTaggedValues, now);

                                if (gecPrivate.userContext !== null) {
                                    gecPrivate.userContext.contestCards = gecPrivate.contestCards;
                                }

                                callbackOnSuccess.call(this, gecPrivate.userContext);
                            },
                            callbackOnException: function (response) {

                                callbackOnException.call(this, new gec.AsyncException({
                                    returnCode: 2 /* SystemError */,
                                    name: getReturnCodeName(2)
                                }));

                            }
                        });

                    } else {

                        // Punter is not registered for any contests

                        gecPrivate.contestCards = undefined;

                        if (gecPrivate.userContext !== null) {
                            gecPrivate.userContext.contestCards = gecPrivate.contestCards;
                        }

                        callbackOnSuccess.call(this, gecPrivate.userContext);

                    }

                },
                callbackOnException: function (resp) {

                    callbackOnException.call(this, new gec.AsyncException({
                        returnCode: 2 /* SystemError */,
                        name: getReturnCodeName(2)
                    }));
                }
            });

        }


        var _establishUserSessionResponse = function (request, response) {

            var userContext = null;

            if (response.returnCode != 0) {

                if (response.returnCode === gec.ReturnCode.LocationNotSpecified) {
                        gecPrivate._base.setCookie("geoLocationPermission", "denied_relevant_state", 9999, gecPrivate.sameSiteValueForCookies);
                }

                request.callbackOnException.call(this, new gec.AsyncException({
                    returnCode: response.returnCode,
                    message: response.geoLocateErrorMessage ? response.geoLocateErrorMessage.split('\r\n')[0] : undefined,
                    name: getReturnCodeName(response.returnCode)
                }));

            } else {

                gecPrivate.sessionToken = response.sessionToken;
                _telebetSessionToken = null;
                gecPrivate._maxSequenceNo = 0;
                userContext = new gec.UserContext();

                userContext.partnerUsername = request.partnerUsername || request.partnerUsernameForUserContext;
                userContext.punterId = response.punterId;
                userContext.debitSportsbookStake = response.debitSportsbookStake;
                userContext.debitExchangeStake = response.debitExchangeStake;
                userContext.purseIntegraionModeId = response.purseIntegrationMode;
                userContext.canPlaceForSideOrders = response.canPlaceForSideOrders;
                userContext.canPlaceAgainstSideOrders = response.canPlaceAgainstSideOrders;
                userContext.canDeposit = response.canDeposit;
                userContext.canWithdraw = response.canWithdraw;
                userContext.canPlaceOrders = response.canPlaceOrders;
                userContext.restrictedToFillKillOrders = response.restrictedToFillKillOrders;
                userContext.currency = response.currency;
                userContext.language = response.language;
                userContext.priceFormat = response.priceFormat;
                userContext.marketByVolumeAmount = response.marketByVolumeAmount.amount;
                userContext.logonAttempts = response.logonAttempts;
                userContext.punterClassificationId = response.punterClassificationId;
                userContext.punterClassificationName = response.punterClassificationName;
                userContext.cohort = response.cohort;
                userContext.state = response.state;
                userContext.zipcode = response.zipcode;
                userContext.wageringCohort = response.wageringCohort;
                userContext.aDWPointsEarned = response.aDWPointsEarned;
                userContext.isOnLegacyRegime = response.isOnLegacyRegime;
                userContext.canBackSP = response.canBackSP;
                userContext.canLaySP = response.canLaySP;
                userContext.location = request.location;
                userContext.tmxReviewStatus = response.tmxReviewStatus;
                userContext.whiteLabel = response.whiteLabel;
                userContext.isIdentityEstablished = response.isIdentityEstablished;
                userContext.isASubPunter = response.isASubPunter;
                userContext.hasSubPunters = response.hasSubPunters;
                userContext.canAddSubPunters = response.canAddSubPunters;
                userContext.geolocateInSeconds = response.geolocateInSeconds;

                _username = request.partnerUsername;
                _password = request.cleartextPassword;

                gecPrivate.userContext = userContext;

                if (_params.isSessionPresent === true) {
                    _arbRefreshID = window.setInterval(function () {
                        if (getIdleDuration() < _cookieTimeout) {
                            refreshArbitrarySessionInformation(_thisController);
                            _keepAlive = false;
                        }

                    }, _cookieRefreshRate);
                }

                _params.isSessionPresent = true;

                // Check for contest GTV(s) for punter, in form "GEC.Contest.<punterId>.<contestName>"
                if (gec.Controller.prototype.listCards !== undefined) {
                    gecPrivate.getListOfContestCardsForPunter(response.punterId, request.callbackOnSuccess, request.callbackOnException);
                } else {
                    request.callbackOnSuccess.call(this, gecPrivate.userContext);
                }

            }
        };

        var _arbRefreshID;
        var _keepAlive = false;
        var _lastKeepAlive = +new Date();

        this.keepAlive = function () {
            _keepAlive = true;
            _lastKeepAlive = +new Date();

        };
        var getIdleDuration = function () {
            var now = +new Date();
            return now - _lastKeepAlive;
        };

        gecPrivate.checkExpiredSession = function (returnCode) {
            if ((_params.isSessionPresent) && (_params.onSessionExpired)) {
                if ((returnCode == 512) || (returnCode == 514) || (returnCode == 520)) {
                    _params.isSessionPresent = false;
                    window.clearInterval(_arbRefreshID);
                    _clearUserContextVariables();
                    _params.onSessionExpired.call();
                }
            }
        }
        var refreshArbitrarySessionInformation = function (ctx) {

            if (gecPrivate.neverCallRefreshArbitrarySessionInformation === true) {
                // This is a hack to prevent RefreshArbitrarySessionInformation being
                // called on sites that never need it.
                // (It can be triggered if establishUserSession is called more than once by a site)
                return;
            }

            var request = new gec.IAPIRequest();

            request.sessionToken = gecPrivate.sessionToken;

            ctx.sendRequest('/RefreshArbitrarySessionInformation.ashx', request, _refreshArbitrarySessionInformationResponse);
        };
        var _refreshArbitrarySessionInformationResponse = function (request, response) {

            if (response.returnCode != 0) {
                gecPrivate._base.log("Exception Refreshing Arbitrary Session Information");
            }
            gecPrivate.checkExpiredSession(response.returnCode);
        };

        // Check if session token cookie has expired - if it has, log the user out
        var isSessionTokenCookieExpired = function () {
            var sessionTokenCookie = gecPrivate._base.getCookie(sessionTokenCookieName);
            if (sessionTokenCookie == "") {

                // Session token cookie has expired, so log user out
                _clearUserContextVariables();

                // Clear the timer that checks if the session has expired
                window.clearInterval(_arbRefreshID);

                // Call callback function supplied
                if (_params.onSessionExpired)
                    _params.onSessionExpired.call();

                return true;
            }
            else
                return false;
        }

        // Extend the life of the session token cookie
        var extendLifeOfSessionTokenCookie = function () {

            // Extend life of session token cookie
            var cookieTimeoutInDays = _cookieTimeout / (1000 * 60 * 60 * 24);
            gecPrivate._base.setCookie(sessionTokenCookieName, gecPrivate.sessionToken, cookieTimeoutInDays, gecPrivate.sameSiteValueForCookies);
            gecPrivate._base.setCookie(gecPrivate.userContextCookieName, JSON.stringify(gecPrivate.userContext), cookieTimeoutInDays, gecPrivate.sameSiteValueForCookies);
        }

        /****************************
        establishUserSessionEnhanced
        ****************************/
        this.establishUserSessionEnhanced = function (params) {
            var requiredParams = {
                initialLanguage: "en",
                numberLogonAttemptsToReturn: 1,
                granularChannelType: 1,
                channelInformation: ""
            };
            var request = new gec.IAPIRequest(params, requiredParams);
            var thisGEC = this;

            if (params.partnerToken != null) {
                request.partnerToken = params.partnerToken;
                try {
                    request.partnerUsername = JSON.parse(window.atob(params.partnerToken)).partnerUsername;
                } catch (ex) {
                    console.error("Exception parsing partnerToken");
                    console.error(params.partnerToken);
                    console.error(ex);
                }
            } else if (params.identityXRequestId != null) {
                request.partnerUsername = params.partnerUsername;
                request.identityXRequestId = params.identityXRequestId;
                request.identityXToken = params.identityXToken;
                request.currency = controllerDefaults.currency;
            } else {
                request.integrationPartnerId = params.integrationPartnerId;
                request.partnerUsername = params.partnerUsername;
                request.cleartextPassword = params.cleartextPassword;
                request.passwordToken = params.passwordToken;

                request.currency = controllerDefaults.currency;
            }
            request.language = controllerDefaults.language;
            request.clientIdentifier = params.clientIdentifier;
            request.granularChannelType = params.granularChannelType;
            request.channelInformation = params.channelInformation;
            request.reCAPTCHAToken = params.reCAPTCHAToken;
            request.twoFactorAuthenticationCode = params.twoFactorAuthenticationCode;
            request.trustedDeviceToken = params.trustedDeviceToken;
            request.initialLanguage = params.initialLanguage;
            request.numberLogonAttemptsToReturn = params.numberLogonAttemptsToReturn;
            request.tmxSessionId = params.tmxSessionId;
            request.tmxWebSessionId = params.tmxWebSessionId;
            request.tmxPageId = params.tmxPageId;
            request.fingerprint = params.fingerprint;
            request.location = params.location;
            request.geoLocationToken = params.geoLocationToken;

            if (params.finalIPAddress) {
                request.finalIPAddress = params.finalIPAddress;
            }

            if (params.requestLocationInformation) {

                this.getBrowserGeoLocation(function (location) {

                    if (location) {
                        request.location = {};
                        request.location.latitude = location.latitude;
                        request.location.longitude = location.longitude;
                        request.location.accuracy = Math.round(location.accuracy);

                        thisGEC.sendRequest('/EstablishSessionEnhanced.ashx', request, _establishUserSessionEnhancedResponse);
                    } else {
                        request.callbackOnException.call(this, new gec.AsyncException({
                            returnCode: gec.ReturnCode.LocationNotSpecified,
                            name: getReturnCodeName(gec.ReturnCode.LocationNotSpecified)
                        }));
                    }

                });

            } else {

                thisGEC.sendRequest('/EstablishSessionEnhanced.ashx', request, _establishUserSessionEnhancedResponse);

            }

        };

        var _establishUserSessionEnhancedResponse = function (request, response) {

            if (response.returnCode != 0) {

                if (response.returnCode === gec.ReturnCode.LocationNotSpecified) {
                    gecPrivate._base.setCookie("geoLocationPermission", "denied_relevant_state", 9999);
                }

                // 982 IdentityXTokenNotAuthenticated
                if (response.returnCode === 982) {
                    request.callbackOnException.call(this, new gec.AsyncException({
                        returnCode: response.returnCode,
                        name: "IdentityXTokenNotAuthenticated",
                        identityXStatus: response.identityXStatus,
                        identityXAuthenticationResponse: response.identityXAuthenticationResponse,
                        identityXCode: response.identityXCode,
                        identityXMessage: response.identityXMessage
                    }));

                    return;
                }

                request.callbackOnException.call(this, new gec.AsyncException({
                    returnCode: response.returnCode,
                    name: getReturnCodeName(response.returnCode)
                }));

            } else {

                var userContext = new gec.UserContextEnhanced();

                gecPrivate.sessionToken = response.sessionToken;
                _telebetSessionToken = null;
                gecPrivate._maxSequenceNo = 0;

                userContext.partnerUsername = request.partnerUsername;
                userContext.punterId = response.punterId;
                userContext.debitSportsbookStake = response.debitSportsbookStake;
                userContext.debitExchangeStake = response.debitExchangeStake;
                userContext.purseIntegraionModeId = response.purseIntegrationMode;
                userContext.canPlaceForSideOrders = response.canPlaceForSideOrders;
                userContext.canPlaceAgainstSideOrders = response.canPlaceAgainstSideOrders;
                userContext.canPlaceOrders = response.canPlaceOrders;
                userContext.canDeposit = response.canDeposit;
                userContext.canWithdraw = response.canWithdraw;
                userContext.restrictedToFillKillOrders = response.restrictedToFillKillOrders;
                userContext.currency = response.currency;
                userContext.language = response.language;
                userContext.priceFormat = response.priceFormat;
                userContext.marketByVolumeAmount = response.marketByVolumeAmount.amount;
                userContext.availableBalance = response.availableBalance.amount;

                userContext.isRetailPunter = response.isRetailPunter;
                userContext.numberFreeBets = response.numberFreeBets;
                userContext.sumAmountRemaining = response.sumAmountRemaining.amount;
                userContext.reserved = response.reserved;
                userContext.punterClassificationId = response.punterClassificationId;
                userContext.punterClassificationName = response.punterClassificationName;
                userContext.cohort = response.cohort;
                userContext.state = response.state;
                userContext.zipcode = response.zipcode;
                userContext.wageringCohort = response.wageringCohort;
                userContext.aDWPointsEarned = response.aDWPointsEarned;
                userContext.isOnLegacyRegime = response.isOnLegacyRegime;
                userContext.canBackSP = response.canBackSP;
                userContext.canLaySP = response.canLaySP;

                userContext.isASubPunter = response.isASubPunter;
                userContext.hasSubPunters = response.hasSubPunters;
                userContext.whiteLabel = response.whiteLabel;

                userContext.identityXStatus = response.identityXStatus;
                userContext.identityXAuthenticationResponse = response.identityXAuthenticationResponse;
                userContext.identityXCode = response.identityXCode;
                userContext.identityXMessage = response.identityXMessage;
                userContext.tmxReviewStatus = response.tmxReviewStatus;
                userContext.isIdentityEstablished = response.isIdentityEstablished;
                userContext.geolocateInSeconds = response.geolocateInSeconds;

                userContext.logonAttempts = [{
                    attemptedAt: response.lastLogonAttempt,
                    punterIPAddress: null,
                    logonSucceeded: null

                }, {
                    attemptedAt: response.lastSuccessfulLogon,
                    punterIPAddress: null,
                    logonSucceeded: true
                }


                ];

                if (_params.isSessionPresent === true) {
                    _arbRefreshID = window.setInterval(function () {

                        if (_storeSessionTokenInCookieWithExpiryTime && isSessionTokenCookieExpired())
                            return;

                        if (_keepAlive) {

                            if (_storeSessionTokenInCookieWithExpiryTime && (gecPrivate.sessionToken != null))
                                extendLifeOfSessionTokenCookie();
                            else
                                refreshArbitrarySessionInformation(_thisController);

                            _keepAlive = false;

                            // If callback exists, call it to let calling code know we have extended the session
                            if (_params.onSessionExtended)
                                _params.onSessionExtended.call();
                        }

                    }, _cookieRefreshRate);
                }


                if (_storeSessionTokenInCookieWithExpiryTime && (gecPrivate.sessionToken != null)) {
                    var cookieTimeoutInDays = _cookieTimeout / (1000 * 60 * 60 * 24);
                    gecPrivate._base.setCookie(sessionTokenCookieName, gecPrivate.sessionToken, cookieTimeoutInDays, gecPrivate.sameSiteValueForCookies);
                    gecPrivate._base.setCookie(gecPrivate.userContextCookieName, JSON.stringify(userContext), cookieTimeoutInDays, gecPrivate.sameSiteValueForCookies);
                    _params.isSessionPresent = true;
                }

                _params.isSessionPresent = true;

                _username = request.partnerUsername;
                _password = request.cleartextPassword;

                gecPrivate.userContext = userContext;
                request.callbackOnSuccess.call(this, userContext);
            }
        };
        /****************************
        establishTelebetSession
        ****************************/
        this.establishTelebetSession = function (params) {
            var request = new gec.IAPIRequest(params);
            request.jSONWebToken = params.jSONWebToken;
            request.partnerTelebetToken = params.partnerTelebetToken;
            this.sendRequest('/EstablishTelebetSession.ashx', request, _establishTelebetSessionResponse);
        };
        var _establishTelebetSessionResponse = function (request, response) {
            if (response.returnCode == 0) {
                gecPrivate.sessionToken = undefined;
                _telebetSessionToken = response.telebetSessionToken;
                _thisController.clearUserContext();

                request.callbackOnSuccess.call(this, {});
            } else {
                request.callbackOnException.call(this, response);
            }
        };

        /****************************
        getBalance
        ****************************/
        this.getBalance = function (params) {
            if (gecPrivate.userContext == null) {
                params.callbackOnException.call(this, { returnCode: 590, message: "NeitherUserNorTelebetUserSession" });
            }
            else {
                var request = new gec.IAPIRequest(params);

                request.sessionToken = gecPrivate.sessionToken;

                this.sendRequest('/GetBalance.ashx', request, _getBalanceResponse);
            }
        };
        var _getBalanceResponse = function (request, response) {
            if (response.returnCode == 0) {
                var amount = (response.availableBalance !== undefined) ? response.availableBalance.amount : 0;
                var withdrawableBalanceAmount = (response.withdrawableBalance !== undefined) ? response.withdrawableBalance.amount : 0;

                request.callbackOnSuccess.call(this, {
                    balance: amount, 	// Obsolete - retained for backwards compatibility
                    availableBalance: amount,
                    withdrawableBalance: withdrawableBalanceAmount
                });
            } else {
                gecPrivate.checkExpiredSession(response.returnCode);
                request.callbackOnException.call(this, response);
            }

        };


        /****************************
        getDefinitiveBalance
        ****************************/

        this.getDefinitiveAvailableBalance = function (params) {
            if (gecPrivate.userContext == null) {
                params.callbackOnException.call(this, { returnCode: 590, message: "NeitherUserNorTelebetUserSession" });
            } else {
                var request = new gec.IAPIRequest(params);
                request.sessionToken = gecPrivate.sessionToken;
                this.sendRequest('/GetDefinitiveAvailableBalance.ashx', request, _getDefinitiveAvailableBalanceResponse);
            }
        };

        var _getDefinitiveAvailableBalanceResponse = function (request, response) {
            if (response.returnCode == 0) {
                request.callbackOnSuccess.call(this, {
                    availableBalance: response.availableBalance,
                    externalBalanceObtained: response.externalBalanceObtained
                });
            } else {
                gecPrivate.checkExpiredSession(response.returnCode);
                request.callbackOnException.call(this, response);
            }

        };


        /****************************
        getPunterFundingTotal
        ****************************/

        this.getPunterFundingTotal = function (params) {
            if (gecPrivate.userContext == null) {
                params.callbackOnException.call(this, { returnCode: 590, message: "NeitherUserNorTelebetUserSession" });
            } else {
                var request = new gec.IAPIRequest(params);
                request.sessionToken = gecPrivate.sessionToken;
                this.sendRequest('/GetPunterFundingTotal.ashx', request, _getPunterFundingTotalResponse);
            }
        };

        var _getPunterFundingTotalResponse = function (request, response) {
            if (response.returnCode == 0) {

                request.callbackOnSuccess.call(this, {
                    totalNetDeposits: response.totalNetDeposits.amount
                });
            } else {
                gecPrivate.checkExpiredSession(response.returnCode);
                request.callbackOnException.call(this, response);
            }

        };

        /****************************
        turnTwoFactorAuthenticationOn
        ****************************/

        this.turnTwoFactorAuthenticationOn = function (params) {
            if (gecPrivate.userContext == null) {
                params.callbackOnException.call(this, {
                    returnCode: 590, message: "NeitherUserNorTelebetUserSession"
                });
            } else {
                var request = new gec.IAPIRequest(params);
                request.sessionToken = gecPrivate.sessionToken;
                this.sendRequest('/TurnTwoFactorAuthenticationOn.ashx', request, _turnTwoFactorAuthenticationOnResponse);
            }
        };

        var _turnTwoFactorAuthenticationOnResponse = function (request, response) {
            if (response.returnCode === 0) {
                request.callbackOnSuccess.call(this, {
                    secretKey: response.secretKey
                });
            } else {
                gecPrivate.checkExpiredSession(response.returnCode);
                request.callbackOnException.call(this, response);
            }

        };

        /****************************
        confirmTwoFactorAuthenticationOn
        ****************************/

        this.confirmTwoFactorAuthenticationOn = function (params) {
            if (gecPrivate.userContext == null) {
                params.callbackOnException.call(this, {
                    returnCode: 590, message: "NeitherUserNorTelebetUserSession"
                });
            } else {
                var request = new gec.IAPIRequest(params);
                request.sessionToken = gecPrivate.sessionToken;
                request.twoFactorAuthenticationCode = params.twoFactorAuthenticationCode;
                this.sendRequest('/ConfirmTwoFactorAuthenticationOn.ashx', request, _confirmTwoFactorAuthenticationOnResponse);
            }
        };

        var _confirmTwoFactorAuthenticationOnResponse = function (request, response) {
            if (response.returnCode === 0) {
                request.callbackOnSuccess.call(this, {});
            } else {
                gecPrivate.checkExpiredSession(response.returnCode);
                request.callbackOnException.call(this, response);
            }

        };

        /****************************
        turnTwoFactorAuthenticationOff
        ****************************/

        this.turnTwoFactorAuthenticationOff = function (params) {
            if (gecPrivate.userContext == null) {
                params.callbackOnException.call(this, {
                    returnCode: 590, message: "NeitherUserNorTelebetUserSession"
                });
            } else {
                var request = new gec.IAPIRequest(params);
                request.sessionToken = gecPrivate.sessionToken;
                this.sendRequest('/TurnTwoFactorAuthenticationOff.ashx', request, _turnTwoFactorAuthenticationOffResponse);
            }
        };

        var _turnTwoFactorAuthenticationOffResponse = function (request, response) {
            if (response.returnCode === 0) {
                request.callbackOnSuccess.call(this, {});
            } else {
                gecPrivate.checkExpiredSession(response.returnCode);
                request.callbackOnException.call(this, response);
            }

        };

        /****************************
        addTrustedDevice
        ****************************/
        this.addTrustedDevice = function (params) {
            if (gecPrivate.userContext == null) {
                params.callbackOnException.call(this, {
                    returnCode: 590, message: "NeitherUserNorTelebetUserSession"
                });
            } else {
                var request = new gec.IAPIRequest(params);
                request.sessionToken = gecPrivate.sessionToken;

                request.deviceName = params.deviceName;
                request.trustedDeviceToken = params.trustedDeviceToken;

                this.sendRequest('/AddTrustedDevice.ashx', request, _addTrustedDeviceResponse);
            }
        };

        var _addTrustedDeviceResponse = function (request, response) {
            if (response.returnCode === 0) {
                request.callbackOnSuccess.call(this, {});
            } else {
                gecPrivate.checkExpiredSession(response.returnCode);
                request.callbackOnException.call(this, new gec.AsyncException({ returnCode: response.returnCode }));
            }
        };

        /****************************
        removeTrustedDevice
        ****************************/
        this.removeTrustedDevice = function (params) {
            if (gecPrivate.userContext == null) {
                params.callbackOnException.call(this, {
                    returnCode: 590, message: "NeitherUserNorTelebetUserSession"
                });
            } else {
                var request = new gec.IAPIRequest(params);
                request.sessionToken = gecPrivate.sessionToken;
                request.deviceName = params.deviceName;

                this.sendRequest('/RemoveTrustedDevice.ashx', request, _removeTrustedDeviceResponse);
            }
        };

        var _removeTrustedDeviceResponse = function (request, response) {
            if (response.returnCode === 0) {
                request.callbackOnSuccess.call(this, {});
            } else {
                gecPrivate.checkExpiredSession(response.returnCode);
                request.callbackOnException.call(this, response);
            }

        };

        /****************************
        listTrustedDevices
        ****************************/
        this.listTrustedDevices = function (params) {
            if (gecPrivate.userContext == null) {
                params.callbackOnException.call(this, {
                    returnCode: 590, message: "NeitherUserNorTelebetUserSession"
                });
            } else {
                var request = new gec.IAPIRequest(params);
                request.sessionToken = gecPrivate.sessionToken;

                this.sendRequest('/ListTrustedDevices.ashx', request, _listTrustedDevicesResponse);
            }
        };

        var _listTrustedDevicesResponse = function (request, response) {
            if (response.returnCode === 0) {
                request.callbackOnSuccess.call(this, {
                    trustedDevices: response.trustedDevices
                });
            } else {
                gecPrivate.checkExpiredSession(response.returnCode);
                request.callbackOnException.call(this, response);
            }

        };

        /****************************
        setTrustDevices
        ****************************/
        this.setTrustDevices = function (params) {
            if (gecPrivate.userContext == null) {
                params.callbackOnException.call(this, { returnCode: 590, message: "NeitherUserNorTelebetUserSession" });
            } else {
                var request = new gec.IAPIRequest(params);
                request.sessionToken = gecPrivate.sessionToken;
                request.enable = params.enable;
                this.sendRequest('/SetTrustDevices.ashx', request, _setTrustDevicesResponse);
            }
        };

        var _setTrustDevicesResponse = function (request, response) {
            if (response.returnCode === 0) {
                request.callbackOnSuccess.call(this, {});
            } else {
                gecPrivate.checkExpiredSession(response.returnCode);
                request.callbackOnException.call(this, response);
            }

        };

        /****************************
        listApplicableFTMs
        ****************************/

        this.listApplicableFTMs = function (params) {
            if (gecPrivate.userContext == null) {
                params.callbackOnException.call(this, { returnCode: 590, message: "NeitherUserNorTelebetUserSession" });
            }
            else {
                var request = new gec.IAPIRequest(params);
                request.sessionToken = gecPrivate.sessionToken;

                this.sendRequest('/ListApplicableFTMs.ashx', request, _listApplicableFTMsResponse);
            }
        };

        var _listApplicableFTMsResponse = function (request, response) {
            if (response.returnCode != 0) {
                request.callbackOnException.call(this, { returnCode: response.returnCode });
            }
            else {
                request.callbackOnSuccess.call(this, {
                    fTMs: response.fTMs
                });
            }
        };


        /****************************
        addFTMR
        ****************************/

        this.addFTMR = function (params) {
            if (gecPrivate.userContext == null) {
                params.callbackOnException.call(this, { returnCode: 590, message: "NeitherUserNorTelebetUserSession" });
            }
            else {
                var request = new gec.IAPIRequest(params);
                request.sessionToken = gecPrivate.sessionToken;
                request.nameValuePairs = params.nameValuePairs;
                request.wantDetailsRetained = params.wantDetailsRetained;
                request.nickname = params.nickname;
                if (params.isCurrentActiveWebFTMR !== undefined) {
                    request.isCurrentActiveWebFTMR = params.isCurrentActiveWebFTMR;
                } else {
                    request.isCurrentActiveWebFTMR = true;
                }
                request.fundsTransferMethodId = params.fundsTransferMethodId;

                this.sendRequest('/AddFTMR.ashx', request, _addFTMRResponse);
            }
        };

        var _addFTMRResponse = function (request, response) {
            if (response.returnCode != 0) {
                request.callbackOnException.call(this, { returnCode: response.returnCode });
            }
            else {
                request.callbackOnSuccess.call(this, {
                    fTMRId: response.fTMRId,
                    additionalReturnInformation: response.additionalReturnInformation,
                    extraReturnInformation: response.extraReturnInformation
                });
            }
        };

        /****************************
        updateFTMR
        ****************************/

        this.updateFTMR = function (params) {
            if (gecPrivate.userContext == null) {
                params.callbackOnException.call(this, { returnCode: 590, message: "NeitherUserNorTelebetUserSession" });
            }
            else {
                var request = new gec.IAPIRequest(params);
                request.sessionToken = gecPrivate.sessionToken;
                request.fTMRId = params.fTMRId;
                request.nameValuePairs = params.nameValuePairs;
                request.wantDetailsRetained = params.wantDetailsRetained;
                request.nickname = params.nickname;

                this.sendRequest('/UpdateFTMR.ashx', request, _updateFTMRResponse);
            }
        };

        var _updateFTMRResponse = function (request, response) {
            if (response.returnCode != 0) {
                request.callbackOnException.call(this, { returnCode: response.returnCode });
            }
            else {
                request.callbackOnSuccess.call(this, {
                    fTMRId: response.fTMRId,
                    additionalReturnInformation: response.additionalReturnInformation,
                    extraReturnInformation: response.extraReturnInformation
                });
            }
        };

        /****************************
        removeFTMR
        ****************************/

        this.removeFTMR = function (params) {
            if (gecPrivate.userContext == null) {
                params.callbackOnException.call(this, { returnCode: 590, message: "NeitherUserNorTelebetUserSession" });
            }
            else {
                var request = new gec.IAPIRequest(params);
                request.sessionToken = gecPrivate.sessionToken;
                request.fTMRId = params.fTMRId;

                this.sendRequest('/RemoveFTMR.ashx', request, _removeFTMRResponse);
            }
        };

        var _removeFTMRResponse = function (request, response) {
            if (response.returnCode != 0) {
                request.callbackOnException.call(this, { returnCode: response.returnCode });
            }
            else {
                request.callbackOnSuccess.call(this, {});
            }
        };

        /****************************
        reinstateFTMR
        ****************************/

        this.reinstateFTMR = function (params) {
            if (gecPrivate.userContext == null) {
                params.callbackOnException.call(this, { returnCode: 590, message: "NeitherUserNorTelebetUserSession" });
            }
            else {
                var request = new gec.IAPIRequest(params);
                request.sessionToken = gecPrivate.sessionToken;
                request.fTMRId = params.fTMRId;

                this.sendRequest('/ReinstateFTMR.ashx', request, _reinstateFTMRResponse);
            }
        };

        var _reinstateFTMRResponse = function (request, response) {
            if (response.returnCode != 0) {
                request.callbackOnException.call(this, { returnCode: response.returnCode });
            }
            else {
                request.callbackOnSuccess.call(this, {});
            }
        };

        /****************************
        calculateFTMRCommissionCharges
        ****************************/

        this.calculateFTMRCommissionCharges = function (params) {
            if (gecPrivate.userContext == null) {
                params.callbackOnException.call(this, { returnCode: 590, message: "NeitherUserNorTelebetUserSession" });
            }
            else {
                var request = new gec.IAPIRequest(params);
                request.sessionToken = gecPrivate.sessionToken;
                request.fTMRId = params.fTMRId;
                request.amount = params.amount;
                request.isLodgement = params.isLodgement;

                this.sendRequest('/CalculateFTMRCommissionCharges.ashx', request, _calculateFTMRCommissionChargesResponse);
            }
        };

        var _calculateFTMRCommissionChargesResponse = function (request, response) {
            if (response.returnCode !== 0) {
                request.callbackOnException.call(this, {
                    returnCode: response.returnCode
                });
            } else {
                request.callbackOnSuccess.call(this, {
                    commissionAmount: response.commissionAmount,
                    fTMRAmount: response.fTMRAmount,
                    punterAmount: response.punterAmount
                });
            }
        };

        /****************************
        listFTMRs
        ****************************/

        this.listFTMRs = function (params) {
            if (gecPrivate.userContext == null) {
                params.callbackOnException.call(this, { returnCode: 590, message: "NeitherUserNorTelebetUserSession" });
            }
            else {
                var request = new gec.IAPIRequest(params);
                request.sessionToken = gecPrivate.sessionToken;

                this.sendRequest('/ListFTMRs.ashx', request, _listFTMRsResponse);
            }
        };

        var _listFTMRsResponse = function (request, response) {
            if (response.returnCode != 0) {
                request.callbackOnException.call(this, { returnCode: response.returnCode });
            }
            else {
                if (response.fTMRs !== null) {
                    var ftmr, ftmp;
                    var thisFTMR, thisFTMP;
                    var ftmrs = [];

                    for (var i = 0; i < response.fTMRs.length; i++) {

                        thisFTMR = response.fTMRs[i];

                        ftmr = {};

                        ftmr.fTMRId = thisFTMR.fTMRId;
                        ftmr.status = thisFTMR.status;
                        ftmr.fundsTransferMethodId = thisFTMR.fundsTransferMethodId;
                        ftmr.type = thisFTMR.type;
                        ftmr.name = thisFTMR.name;
                        ftmr.nickname = thisFTMR.nickname;

                        ftmr.nameValuePairs = [];
                        if (thisFTMR.fTMRValues) {
                            for (var j = 0; j < thisFTMR.fTMRValues.length; j++) {
                                ftmp = {};
                                thisFTMP = thisFTMR.fTMRValues[j];

                                ftmp.name = thisFTMP.name;
                                ftmp.value = thisFTMP.value;
                                ftmp.isMandatory = thisFTMP.isMandatory;
                                ftmp.obfuscateDisplay = thisFTMP.obfuscateDisplay;

                                ftmr.nameValuePairs[j] = ftmp;
                            }
                        }

                        ftmr.wantDetailsRetained = thisFTMR.wantDetailsRetained;
                        ftmr.isCurrentActiveWebFTMR = thisFTMR.isCurrentActiveWebFTMR;

                        ftmr.lodgementsAreSupported = thisFTMR.lodgementsAreSupported;
                        ftmr.minLodgementTransactionAmount = thisFTMR.minLodgementTransactionAmount;
                        ftmr.maxLodgementTransactionAmount = thisFTMR.maxLodgementTransactionAmount;
                        ftmr.maxDailyLodgementTransactions = thisFTMR.maxDailyLodgementTransactions;
                        ftmr.maxWeeklyLodgementTransactions = thisFTMR.maxWeeklyLodgementTransactions;
                        ftmr.maxMonthyLodgementTransactions = thisFTMR.maxMonthyLodgementTransactions;
                        ftmr.maxDailyLodgementAmount = thisFTMR.maxDailyLodgementAmount;
                        ftmr.maxWeeklyLodgementAmount = thisFTMR.maxWeeklyLodgementAmount;
                        ftmr.maxMonthlyLodgementAmount = thisFTMR.maxMonthlyLodgementAmount;
                        ftmr.lodgementFixedCharge = thisFTMR.lodgementFixedCharge;
                        ftmr.lodgementSlidingCharge = thisFTMR.lodgementSlidingCharge;
                        ftmr.minLodgementSlidingCharge = thisFTMR.minLodgementSlidingCharge;
                        ftmr.maxLodgementSlidingCharge = thisFTMR.maxLodgementSlidingCharge;

                        ftmr.withdrawalsAreSupported = thisFTMR.withdrawalsAreSupported;
                        ftmr.minWithdrawalTransactionAmount = thisFTMR.minWithdrawalTransactionAmount;
                        ftmr.maxWithdrawalTransactionAmount = thisFTMR.maxWithdrawalTransactionAmount;
                        ftmr.maxDailyWithdrawalTransactions = thisFTMR.maxDailyWithdrawalTransactions;
                        ftmr.maxWeeklyWithdrawalTransactions = thisFTMR.maxWeeklyWithdrawalTransactions;
                        ftmr.maxMonthyWithdrawalTransactions = thisFTMR.maxMonthyWithdrawalTransactions;
                        ftmr.maxDailyWithdrawalAmount = thisFTMR.maxDailyWithdrawalAmount;
                        ftmr.maxWeeklyWithdrawalAmount = thisFTMR.maxWeeklyWithdrawalAmount;
                        ftmr.maxMonthlyWithdrawalAmount = thisFTMR.maxMonthlyWithdrawalAmount;
                        ftmr.withdrawalChargesAreInclusive = thisFTMR.withdrawalChargesAreInclusive;
                        ftmr.withdrawalFixedCharge = thisFTMR.withdrawalFixedCharge;
                        ftmr.withdrawalSlidingCharge = thisFTMR.withdrawalSlidingCharge;
                        ftmr.minWithdrawalSlidingCharge = thisFTMR.minWithdrawalSlidingCharge;
                        ftmr.maxWithdrawalSlidingCharge = thisFTMR.maxWithdrawalSlidingCharge;

                        ftmrs[i] = ftmr;
                    }

                    request.callbackOnSuccess.call(this, { ftmrs: ftmrs });
                }
                else {
                    request.callbackOnSuccess.call(this, { ftmrs: [] });
                }
            }
        };

        /****************************
        lodgeFunds
        ****************************/

        this.lodgeFunds = function (params) {
            if (gecPrivate.userContext == null) {
                params.callbackOnException.call(this, { returnCode: 590, message: "NeitherUserNorTelebetUserSession" });
            }
            else {
                var request = new gec.IAPIRequest(params);
                request.sessionToken = gecPrivate.sessionToken;
                request.fTMRId = params.fTMRId;
                request.amount = params.amount;
                request.commissionAmount = params.commissionAmount;
                request.grossAmount = params.grossAmount;
                request.nameValuePairs = params.nameValuePairs;
                this.sendRequest('/LodgeFunds.ashx', request, _lodgeFundsResponse);
            }
        };
        var _lodgeFundsResponse = function (request, response) {
            if (response.returnCode != 0) {
                request.callbackOnException.call(this, {
                    returnCode: response.returnCode,
                    extraReturnInformation: response.extraReturnInformation
                });
            }
            else {
                request.callbackOnSuccess.call(this, {
                    fundsTransferPaymentId: response.fundsTransferPaymentId,
                    additionalReturnInformation: response.additionalReturnInformation,
                    extraReturnInformation: response.extraReturnInformation
                });
            }
        };


        /****************************
        withdrawFunds
        ****************************/

        this.withdrawFunds = function (params) {
            if (gecPrivate.userContext == null) {
                params.callbackOnException.call(this, { returnCode: 590, message: "NeitherUserNorTelebetUserSession" });
            }
            else {
                var request = new gec.IAPIRequest(params);
                request.sessionToken = gecPrivate.sessionToken;
                request.fTMRId = params.fTMRId;
                request.amount = params.amount;
                request.nameValuePairs = params.nameValuePairs;
                request.existingCleartextPassword = params.existingCleartextPassword;
                this.sendRequest('/WithdrawFunds.ashx', request, _withdrawFundsResponse);
            }
        };
        var _withdrawFundsResponse = function (request, response) {
            if (response.returnCode != 0) {
                request.callbackOnException.call(this, { returnCode: response.returnCode });
            }
            else {
                request.callbackOnSuccess.call(this, {
                    withdrawalRequestId: response.withdrawalRequestId,
                    paymentGatewayRequestId: response.paymentGatewayRequestId,
                    additionalReturnInformation: response.additionalReturnInformation,
                    extraReturnInformation: response.extraReturnInformation
                });
            }
        };

        /**
         * getMarketAttributes - Gets specific properties of a market
         * @param {Array} marketIds
         * @param {Array} attributes - array of enum ids e.g. 1,2,3,4,5
         * @param {String} currency 
         */
        this.getMarketAttributes = function (params) {

            var request = new gec.IAPIRequest(params);

            request.marketIds = params.marketIds;
            request.attributes = params.attributes;
            request.currency = params.currency;

            this.sendRequest('/GetMarketAttributes.ashx', request, function (request, response) {

                if (response.returnCode !== 0) {
                    request.callbackOnException.call(this, new gec.AsyncException(response));
                }
                else {
                    request.callbackOnSuccess.call(this, response.markets);
                }

            });

        };

        /****************************
        getMaxInstantFundingAmount
        ****************************/

        this.getMaxInstantFundingAmount = function (params) {
            if (gecPrivate.userContext == null) {
                params.callbackOnException.call(this, { returnCode: 590, message: "NeitherUserNorTelebetUserSession" });
            }
            else {
                var request = new gec.IAPIRequest(params);
                request.sessionToken = gecPrivate.sessionToken;
                request.fTMRId = params.fTMRId;
                request.granularChannelType = params.granularChannelType;
                this.sendRequest('/GetMaxInstantFundingAmount.ashx', request, _getMaxInstantFundingAmountResponse);
            }
        };
        var _getMaxInstantFundingAmountResponse = function (request, response) {
            if (response.returnCode != 0) {
                request.callbackOnException.call(this, { returnCode: response.returnCode });
            }
            else {
                request.callbackOnSuccess.call(this, {
                    maxInstantFundingAmount: response.maxInstantFundingAmount
                });
            }
        };

        /****************************
        listUnclearedACHTransactions
        ****************************/

        this.listUnclearedACHTransactions = function (params) {
            if (gecPrivate.userContext == null) {
                params.callbackOnException.call(this, { returnCode: 590, message: "NeitherUserNorTelebetUserSession" });
            }
            else {
                var request = new gec.IAPIRequest(params);
                request.sessionToken = gecPrivate.sessionToken;
                this.sendRequest('/ListUnclearedACHTransactions.ashx', request, _listUnclearedACHTransactionsResponse);
            }
        };
        var _listUnclearedACHTransactionsResponse = function (request, response) {
            if (response.returnCode != 0) {
                request.callbackOnException.call(this, { returnCode: response.returnCode });
            }
            else {
                var aCHTransactions = [];

                if (response.transactions) {
                    for (var i = 0; i < response.transactions.length; i++) {

                        response.transactions[i].amountRequested = response.transactions[i].amountRequested.amount;
                        if (typeof response.transactions[i].fundsPending != "undefined")
                            response.transactions[i].fundsPending = response.transactions[i].fundsPending.amount;
                        if (typeof response.transactions[i].advanceFundingGranted != "undefined")
                            response.transactions[i].advanceFundingGranted = response.transactions[i].advanceFundingGranted.amount;

                        if (response.transactions[i].fundsTransferTransferType == 2) {		// LodgeFunds
                            aCHTransactions.push(response.transactions[i]);
                        }

                    }
                }

                request.callbackOnSuccess.call(this, { aCHTransactions: aCHTransactions });
            }
        };

        /****************************
        getIntegrationPartnerParameters
        ****************************/
        var getIntegrationPartnerParameters = function (params) {
            if ((controllerDefaults == null) && (gecPrivate.userContext == null)) {
                params.callbackOnException.call(this, { returnCode: 591, message: 'DefaultsNotLoaded' });;
            }
            else {
                var request = new gec.IAPIRequest(params);

                if (gecPrivate.userContext !== null) {
                    request.integrationPartnerId = gecPrivate.userContext.integrationPartnerId;
                }
                else //use defaults
                {
                    request.integrationPartnerId = controllerDefaults.integrationPartnerId;
                }


                this.sendRequest("/GetIntegrationPartnerParameters.ashx", request, _getIntegrationPartnerParametersResponse);
            }

        };
        var _getIntegrationPartnerParametersResponse = function (request, response) {
            var returnObject;
            if (response.returnCode == 0) {
                request.callbackOnSuccess.call(this, returnObject);
            } else {
                request.callbackOnException.call(this, response);
            }
        };
        /****************************
        listGenericTaggedValues
        ****************************/
        this.listGenericTaggedValues = function (params) {
            params.header = gecPrivate._GBEHeader;

            // Session token not absolutely required by IAPI, but if we have one
            // we include it in the request, for tracking purposes
            params.sessionToken = gecPrivate.sessionToken;

            this.sendRequest("/ListGenericTaggedValues.ashx", params, _listGenericTaggedValuesResponse);
        }
        var _listGenericTaggedValuesResponse = function (request, response) {
            var returnObject;
            if (response.returnCode == 0) {
                returnObject = response.taggedValues;
                request.callbackOnSuccess.call(this, returnObject);
            } else {
                request.callbackOnException.call(this, response);
            }
        }
        /****************************
        loadEventCache
        ****************************/
        this.loadEventCache = function (params) {
            var request;
            if (params.wantSportsbookMarkets && params.playMarkets) {
                params.callbackOnException.call(this, { returnCode: 310 });
            }
            else
                if ((controllerDefaults == null) && (gecPrivate.userContext == null)) {
                    params.callbackOnException.call(this, { returnCode: 591 });
                }
                else {
                    request = new gec.IAPIRequest(params);

                    request.sessionToken = gecPrivate.sessionToken;
                    request.eventClassifierId = _topLevelId;

                    request.wantIndirectDescendents = true;
                    request.wantMultiplesOnly = false;

                    if (gecPrivate.userContext != null) {
                        request.language = gecPrivate.userContext.language;
                        request.integrationPartnerId = controllerDefaults.integrationPartnerId;
                    }
                    else //use defaults
                    {
                        request.language = controllerDefaults.language;
                        request.integrationPartnerId = controllerDefaults.integrationPartnerId;
                    }

                    window.clearInterval(_eventPollInterval);

                    if (params.wantSportsbookMarkets) {
                        this.sendRequest('/ListSportsbookMarkets.ashx', request, _listTopLevelSportsbookEventsResponse, listExchangeMarketsXHR);
                        var context = this;
                        _eventPollInterval = window.setInterval(function () {
                            delete request.callbackOnSuccess;
                            delete request.callbackOnException;
                            request.wantIndirectDescendents = true;
                            context.sendRequest('/ListSportsbookMarkets.ashx', request, _listTopLevelSportsbookEventsResponse, listExchangeMarketsXHR);
                        }, _eventCacheRefreshRate);

                    }
                    else {
                        request.playMarkets = params.playMarkets;
                        request.excludeMarkets = params.excludeMarkets;

                        if (params.preloadedExchangemarkets) {
                            _listTopLevelExchangeEventsResponse(request, params.preloadedExchangemarkets)
                        } else {
                            this.sendRequest('/ListExchangeMarkets.ashx', request, _listTopLevelExchangeEventsResponse, listExchangeMarketsXHR);
                        }
                        var context = this;
                        _eventPollInterval = window.setInterval(function () {
                            delete request.callbackOnSuccess;
                            delete request.callbackOnException;
                            request.wantIndirectDescendents = true;
                            context.sendRequest('/ListExchangeMarkets.ashx', request, _listTopLevelExchangeEventsResponse, listExchangeMarketsXHR);
                        }, _eventCacheRefreshRate);
                    }
                }
        };
        var _listTopLevelSportsbookEventsResponse = function (request, response) {
            if (response.returnCode === 0) {

                var eventI = 0;
                var lastEvent = null;
                for (var i = 0; i < response.eventClassifiers.length; i++) {
                    var responseEvent = response.eventClassifiers[i];

                    if (gecPrivate._eventClassifiers[responseEvent.eventClassifierId] == null)
                        gecPrivate._eventClassifiers[responseEvent.eventClassifierId] = new gec.EventClassifier();

                    var thisEvent = gecPrivate._eventClassifiers[responseEvent.eventClassifierId];

                    thisEvent.eventClassifierId = responseEvent.eventClassifierId;
                    thisEvent.eventClassifierName = responseEvent.name;
                    thisEvent.shortcutAllMarkets = responseEvent.shortcutAllMarkets;
                    thisEvent.isEnabledForMultipleBets = responseEvent.isEnabledForMultipleBets;

                    thisEvent._parentEventClassifierId = responseEvent.parentEventClassifierId;
                    thisEvent.displayOrder = responseEvent.displayOrder;
                    thisEvent.marketTypeIds = [];
                    thisEvent.keep = true;


                    for (var marketTypeCount = 0; marketTypeCount < responseEvent.marketTypes.length; marketTypeCount++) {
                        thisEvent.marketTypeIds[marketTypeCount] = responseEvent.marketTypes[marketTypeCount];
                    }

                    (function (thisEvent) {
                        gecPrivate._eventClassifiers[thisEvent.eventClassifierId].getChildren = function () {
                            if (gecPrivate._eventClassifiers[thisEvent.eventClassifierId] == null) return [];
                            return _fillEvents(gecPrivate._eventClassifiers[thisEvent.eventClassifierId].eventClassifierId);
                        }
                        gecPrivate._eventClassifiers[thisEvent.eventClassifierId].getParent = function () {
                            if (gecPrivate._eventClassifiers[thisEvent.eventClassifierId] != null)//may have completed
                                return gecPrivate._eventClassifiers[gecPrivate._eventClassifiers[thisEvent.eventClassifierId]._parentEventClassifierId];
                            else
                                return null;
                        }
                        gecPrivate._eventClassifiers[thisEvent.eventClassifierId].getMarkets = function () {
                            if (_eventsMarkets[thisEvent.eventClassifierId] === undefined) {
                                return [];
                            }
                            else {
                                return _eventsMarkets[thisEvent.eventClassifierId].markets.sort(gec.SortOnDisplayOrder);
                            }
                        }
                    })(thisEvent);


                    lastEvent = gecPrivate._eventClassifiers[thisEvent.eventClassifierId];
                    _eventsMarkets[thisEvent.eventClassifierId] = {};
                    _eventsMarkets[thisEvent.eventClassifierId].markets = [];
                }
                for (ev in gecPrivate._eventClassifiers) {
                    if (gecPrivate._eventClassifiers[ev].keep) {
                        delete gecPrivate._eventClassifiers[ev].keep; //remove keep property
                    } else {
                        delete gecPrivate._eventClassifiers[ev]; //remove whole object
                    }
                }

                //_markets = [];
                if (response.markets != null) {
                    var marketI = 0;
                    for (i = 0; i < response.markets.length; i++) {
                        var thisMarket = new gec.Market();
                        var responseMarket = response.markets[i];
                        thisMarket.marketId = responseMarket.marketId;
                        thisMarket.marketName = responseMarket.name;
                        thisMarket.marketType = responseMarket.marketType;
                        thisMarket.willBeInRunning = responseMarket.willBeInRunning;
                        thisMarket.currentlyInRunning = responseMarket.currentlyInRunning;
                        thisMarket.isEnabledForMultipleBets = responseMarket.isEnabledForMultipleBets;
                        thisMarket.isEnabledForEachWayBetting = responseMarket.isEnabledForEachWayBetting;
                        thisMarket.isEnabledForSPBetting = responseMarket.isEnabledForSPBetting;
                        thisMarket.startTime = responseMarket.startTime;
                        thisMarket.keep = true; //temp value to be removed later

                        (function (responseMarket) {
                            thisMarket.getEventClassifier = function () {
                                return gecPrivate._eventClassifiers[responseMarket.parentEventClassifierId];
                            };
                        })(responseMarket);

                        thisMarket.displayOrder = responseMarket.displayOrder;

                        gecPrivate._markets[thisMarket.marketId] = thisMarket;

                        _eventsMarkets[responseMarket.parentEventClassifierId].markets[_eventsMarkets[responseMarket.parentEventClassifierId].markets.length] = gecPrivate._markets[thisMarket.marketId];

                        //remove when fix on broker
                        var tempEvent = thisMarket.getEventClassifier();
                        while (tempEvent) {
                            if (thisMarket.isEnabledForMultipleBets)
                                tempEvent.isEnabledForMultipleBets = thisMarket.isEnabledForMultipleBets;

                            tempEvent = tempEvent.getParent();
                        }

                    }
                }
                for (mk in gecPrivate._markets) {
                    if (gecPrivate._markets[mk].keep) {
                        delete gecPrivate._markets[mk].keep; //remove keep property
                    } else {
                        delete gecPrivate._markets[mk]; //remove whole object
                    }
                }

                if (request.callbackOnSuccess != null)
                    request.callbackOnSuccess.call(this, {});
            }
            else {
                if (request.callbackOnException != null)
                    request.callbackOnException.call(this, new gec.AsyncException(response));
            }

        };
        this.getLocalEventCacheSummary = function () {
            var marketsOnTheseEvents = [];
            var eventsOnTheseEvents = [];
            var multipleMarketCount = 0;
            var allMarketCount = 0;
            var todaysMarketCount = 0;
            var inrunningMarketCount = 0;
            var todaysInrunningMarketCount = 0;
            var today = new Date();
            var lastnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            var tonight = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

            for (marketCount in gecPrivate._markets) {
                allMarketCount++;
                var thisMarket = gecPrivate._markets[marketCount];
                if (thisMarket.isEnabledForMultipleBets && !thisMarket.currentlyInRunning) multipleMarketCount++;

                if ((thisMarket.startTime < tonight) && (thisMarket.startTime > lastnight)) {
                    todaysMarketCount++;

                    if (thisMarket.willBeInRunning) todaysInrunningMarketCount++;
                }
                if (thisMarket.currentlyInRunning) inrunningMarketCount++;




            }

            return {
                markets: marketsOnTheseEvents,
                events: eventsOnTheseEvents,
                multipleMarketCount: multipleMarketCount,
                allMarketCount: allMarketCount,
                todaysMarketCount: todaysMarketCount,
                inrunningMarketCount: inrunningMarketCount,
                todaysInrunningMarketCount: todaysInrunningMarketCount
            };
        };
        //Gets indexed eventClassifier by Id
        this.getCachedEventClassifier = function (eventClassifierId) {
            return gecPrivate._eventClassifiers[eventClassifierId];
        };
        //Gets indexed subscribedEventClassifier by Id
        this.getCachedSubscribedEventClassifier = function (eventClassifierId) {
            return gecPrivate._subscribedExchangeEvent[eventClassifierId];
        };
        //Gets indexed subscribedExchangeMarketMatchedAmount by Id
        this.getCachedSubscribedMarketMatchedAmount = function (marketId) {
            return gecPrivate._subscribedExchangeMarketMatchedAmount[marketId];
        };
        //Gets indexed market by Id
        this.getCachedMarket = function (marketId) {
            return gecPrivate._markets[marketId];
        };
        //Gets indexed selection by Id
        this.getCachedSelection = function (selectionId) {
            return gecPrivate._selections[selectionId];
        };
        //Undocumented Methods
        this._setTopLevelId = function (topLevelId) {
            _topLevelId = topLevelId;
        };

        // Returns userContext (with sessionToken as a property)
        this.getSession = function () {

            if (gecPrivate.userContext == null) return null;

            var session = gecPrivate.userContext;
            session.sessionToken = gecPrivate.sessionToken;

            return JSON.stringify(session);
        }

        this.clearSession = function () {
            _clearUserContextVariables();
        }

        // Sets userContext, which contains the sessionToken
        this.setSession = function (response, callbackOnSuccess) {

            response = JSON.parse(response);

            gecPrivate.sessionToken = response.sessionToken;
            _telebetSessionToken = null;
            gecPrivate._maxSequenceNo = 0;

            gecPrivate.userContext = new gec.UserContext();

            gecPrivate.userContext.partnerUsername = response.partnerUsername;
            gecPrivate.userContext.punterId = response.punterId;
            gecPrivate.userContext.debitSportsbookStake = response.debitSportsbookStake;
            gecPrivate.userContext.debitExchangeStake = response.debitExchangeStake;
            gecPrivate.userContext.purseIntegraionMode = response.purseIntegrationMode;
            gecPrivate.userContext.canPlaceForSideOrders = response.canPlaceForSideOrders;
            gecPrivate.userContext.canPlaceAgainstSideOrders = response.canPlaceAgainstSideOrders;
            gecPrivate.userContext.canDeposit = response.canDeposit;
            gecPrivate.userContext.canWithdraw = response.canWithdraw;
            gecPrivate.userContext.canPlaceOrders = response.canPlaceOrders;
            gecPrivate.userContext.restrictedToFillKillOrders = response.restrictedToFillKillOrders;
            gecPrivate.userContext.currency = response.currency;
            gecPrivate.userContext.language = response.language;
            gecPrivate.userContext.priceFormat = response.priceFormat;
            gecPrivate.userContext.marketByVolumeAmount = (response.marketByVolumeAmount != null) ? response.marketByVolumeAmount.amount || 0 : 0;
            gecPrivate.userContext.logonAttempts = response.logonAttempts;
            gecPrivate.userContext.availableBalance = response.availableBalance;
            gecPrivate.userContext.numberFreeBets = response.numberFreeBets;
            gecPrivate.userContext.sumAmountRemaining = response.sumAmountRemaining;
            gecPrivate.userContext.reserved = response.reserved;
            gecPrivate.userContext.cohort = response.cohort;
            gecPrivate.userContext.wageringCohort = response.wageringCohort;
            gecPrivate.userContext.state = response.state;
            gecPrivate.userContext.zipcode = response.zipcode;
            gecPrivate.userContext.aDWPointsEarned = response.aDWPointsEarned;
            gecPrivate.userContext.isOnLegacyRegime = response.isOnLegacyRegime;
            gecPrivate.userContext.location = response.location;
            gecPrivate.userContext.isASubPunter = response.isASubPunter;
            gecPrivate.userContext.hasSubPunters = response.hasSubPunters;

            gecPrivate.userContext.punterClassificationId = response.punterClassificationId;
            gecPrivate.userContext.punterClassificationName = response.punterClassificationName;

            gecPrivate.userContext.contestRestriction = response.contestRestriction;
            gecPrivate.userContext.contestCards = response.contestCards;

            gecPrivate.contestRestriction = response.contestRestriction;
            gecPrivate.contestCards = response.contestCards;

            _username = response.partnerUsername;
            _params.isSessionPresent = true;

            if (callbackOnSuccess) {
                // Whether contest is currently active or not may have changed since time that userContext
                // was initially created, so check again now
                if (gec.Controller.prototype.listCards !== undefined) {
                    gecPrivate.getListOfContestCardsForPunter(response.punterId, callbackOnSuccess, callbackOnSuccess);
                }
            }

            return true;

        };

        /****************************
        listEvents
        ****************************/
        this.listEvents = function (params) {
            if ((controllerDefaults == null) && (gecPrivate.userContext == null)) {
                params.callbackOnException.call(this, { "returnCode": 591 });
            }
            else {
                var i = 0;
                for (eventCount in gecPrivate._eventClassifiers) {
                    if (gecPrivate._eventClassifiers[eventCount]._parentEventClassifierId == _topLevelId) {
                        gecPrivate._eventClassifiersForClient[i] = gecPrivate._eventClassifiers[eventCount];
                        if (params.fireOnEventClassifiersChange != null)
                            gecPrivate._eventClassifiersForClient[i].fireOnEventClassifiersChange = params.fireOnEventClassifiersChange;
                        i++;
                    }
                }
                gecPrivate._eventClassifiersForClient.sort(gec.SortOnDisplayOrder);

                return gecPrivate._eventClassifiersForClient;
            }
        };


        var _fillEvents = function (evenId) {
            var arrayOfEvents = [];
            var eventI = 0;
            for (ev in gecPrivate._eventClassifiers) {
                if (gecPrivate._eventClassifiers[ev]._parentEventClassifierId == evenId) {
                    arrayOfEvents[eventI++] = gecPrivate._eventClassifiers[ev];
                }
            }
            arrayOfEvents.sort(gec.SortOnDisplayOrder);
            return arrayOfEvents;
        };
        var _fillMarkets = function (evenId) {
            var arrayOfMarkets = [];
            var marketI = 0;
            for (m in gecPrivate._markets) {
                if (gecPrivate._markets[m].getEventClassifier().eventClassifierId == evenId) {
                    arrayOfMarkets[marketI++] = gecPrivate._markets[m];
                }
            }
            arrayOfMarkets.sort(gec.SortOnDisplayOrder);
            return arrayOfMarkets;
        };
        var _fillSportsBookMarkets = function (evenId) {
            var arrayOfMarkets = [];
            var marketI = 0;
            for (m in gecPrivate._markets) {
                if (gecPrivate._markets[m].getEventClassifier().eventClassifierId == evenId) {
                    arrayOfMarkets[marketI++] = gecPrivate._markets[m];
                }
            }
            arrayOfMarkets.sort(gec.SortOnDisplayOrder);
            return arrayOfMarkets;
        };


        var _listTopLevelExchangeEvents = function (params) {
            if ((controllerDefaults == null) && (gecPrivate.userContext == null)) {
                params.callbackOnException.call(this, { returnCode: 591, message: 'DefaultsNotLoaded' });;

            }
            else {
                var request = new gec.IAPIRequest(params);

                request.eventClassifierId = 1;
                request.wantIndirectDescendents = true;

                if (gecPrivate.userContext != null) {
                    request.sessionToken = gecPrivate.sessionToken;
                    request.language = gecPrivate.userContext.language;
                    request.integrationPartnerId = gecPrivate.userContext.integrationPartnerId;
                }
                else //use defaults
                {
                    request.language = controllerDefaults.language;
                    request.integrationPartnerId = controllerDefaults.integrationPartnerId;
                }

                this.sendRequest('/ListExchangeMarkets.ashx', request, _listTopLevelExchangeEventsResponse, listExchangeMarketsXHR);
            }

        };

        var _listTopLevelExchangeEventsResponse = function (request, response) {

            if (response.returnCode === 0) {

                var eventI = 0;
                var lastEvent = null;
                for (var i = 0; i < response.eventClassifiers.length; i++) {
                    var responseEvent = response.eventClassifiers[i];

                    if (gecPrivate._eventClassifiers[responseEvent.eventClassifierId] == null)
                        gecPrivate._eventClassifiers[responseEvent.eventClassifierId] = new gec.EventClassifier();

                    var thisEvent = gecPrivate._eventClassifiers[responseEvent.eventClassifierId];

                    thisEvent.eventClassifierId = responseEvent.eventClassifierId;
                    thisEvent.eventClassifierName = responseEvent.name;
                    thisEvent.shortcutAllMarkets = responseEvent.shortcutAllMarkets;
                    thisEvent.isEnabledForMultipleBets = responseEvent.isEnabledForMultipleBets;

                    thisEvent._parentEventClassifierId = responseEvent.parentEventClassifierId;
                    thisEvent.displayOrder = responseEvent.displayOrder;
                    thisEvent.marketTypeIds = [];
                    thisEvent.keep = true;


                    for (marketTypeCount in responseEvent.marketTypes) {
                        thisEvent.marketTypeIds[marketTypeCount] = responseEvent.marketTypes[marketTypeCount];
                    }

                    (function (thisEvent) {
                        gecPrivate._eventClassifiers[thisEvent.eventClassifierId].getChildren = function () {
                            if (gecPrivate._eventClassifiers[thisEvent.eventClassifierId] == null) return [];
                            return _fillEvents(gecPrivate._eventClassifiers[thisEvent.eventClassifierId].eventClassifierId);
                        }
                        gecPrivate._eventClassifiers[thisEvent.eventClassifierId].getParent = function () {
                            if (gecPrivate._eventClassifiers[thisEvent.eventClassifierId] != null)//may have completed
                                return gecPrivate._eventClassifiers[gecPrivate._eventClassifiers[thisEvent.eventClassifierId]._parentEventClassifierId];
                            else
                                return null;
                        }
                        gecPrivate._eventClassifiers[thisEvent.eventClassifierId].getMarkets = function () {
                            if (_eventsMarkets[thisEvent.eventClassifierId] === undefined) {
                                return [];
                            }
                            else {
                                return _eventsMarkets[thisEvent.eventClassifierId].markets;
                            }
                        }
                    })(thisEvent);


                    lastEvent = gecPrivate._eventClassifiers[thisEvent.eventClassifierId];
                    _eventsMarkets[thisEvent.eventClassifierId] = {};
                    _eventsMarkets[thisEvent.eventClassifierId].markets = [];
                }
                for (ev in gecPrivate._eventClassifiers) {
                    if (gecPrivate._eventClassifiers[ev].keep) {
                        delete gecPrivate._eventClassifiers[ev].keep; //remove keep property
                    } else {
                        delete _eventsMarkets[gecPrivate._eventClassifiers[ev].eventClassifierId];
                        delete gecPrivate._eventClassifiers[ev]; //remove whole object
                    }
                }

                if (response.markets != null) {
                    var marketI = 0;
                    for (i = 0; i < response.markets.length; i++) {
                        var thisMarket = new gec.Market();
                        var responseMarket = response.markets[i];
                        thisMarket.marketId = responseMarket.marketId;
                        thisMarket.marketName = responseMarket.name;
                        thisMarket.marketType = responseMarket.marketType;
                        thisMarket.willBeInRunning = responseMarket.willBeInRunning;
                        thisMarket.currentlyInRunning = responseMarket.currentlyInRunning;
                        thisMarket.isEnabledForMultipleBets = responseMarket.isEnabledForMultipleBets;
                        thisMarket.isEnabledForEachWayBetting = responseMarket.isEnabledForEachWayBetting;
                        thisMarket.isEnabledForSPBetting = responseMarket.isEnabledForSPBetting;
                        thisMarket.startTime = responseMarket.startTime;
                        thisMarket.keep = true; //temp value to be removed later

                        (function (responseMarket) {
                            thisMarket.getEventClassifier = function () {
                                return gecPrivate._eventClassifiers[responseMarket.parentEventClassifierId];
                            };
                        })(responseMarket);

                        thisMarket.displayOrder = responseMarket.displayOrder;

                        gecPrivate._markets[thisMarket.marketId] = thisMarket;

                        _eventsMarkets[responseMarket.parentEventClassifierId].markets[_eventsMarkets[responseMarket.parentEventClassifierId].markets.length] = gecPrivate._markets[thisMarket.marketId];

                    }
                }
                for (mk in gecPrivate._markets) {
                    if (gecPrivate._markets[mk].keep) {
                        delete gecPrivate._markets[mk].keep; //remove keep property
                    } else {

                        if (gecPrivate._markets[mk].getEventClassifier() !== undefined) {
                            var eventId = gecPrivate._markets[mk].getEventClassifier().eventClassifierId;
                            //  console.log("found eventClassifer:" + eventId);
                            var m = _eventsMarkets[eventId].markets.length;
                            while (m--) {

                                if (_eventsMarkets[eventId].markets[m].marketId == mk) {
                                    _eventsMarkets[eventId].markets.splice(m, 1);
                                    // console.log("delete market from _eventsMarkets array:" + mk);
                                }
                            }
                        }

                        delete gecPrivate._markets[mk]; //remove whole object
                    }
                }

                if (request.callbackOnSuccess != null)
                    request.callbackOnSuccess.call(this, {});
            }
            else {
                if (request.callbackOnException != null)
                    request.callbackOnException.call(this, new gec.AsyncException(response));
            }
        };


        /****************************
        loadOddsLadder
        ****************************/
        this.loadOddsLadder = function (params) {
            if ((controllerDefaults == null) && (gecPrivate.userContext == null)) {
                params.callbackOnException.call(this, new gec.AsyncException({ returnCode: 591 }));
            }
            else {
                var request = new gec.IAPIRequest(params);
                request.priceFormat = params.priceFormat;
                if (gecPrivate.userContext != null) {
                    request.integrationPartnerId = gecPrivate.userContext.integrationPartnerId;
                }
                else {
                    request.integrationPartnerId = controllerDefaults.integrationPartnerId;
                }
                this.sendRequest('/GetOddsLadder.ashx', request, _loadOddsLadderResponse);
            }
        };
        var _loadOddsLadderResponse = function (request, response) {
            if (response.returnCode != 0) {
                request.callbackOnException.call(this, { returnCode: response.returnCode });
            } else {
                _oddsLadder = response.oddsLadder;
                request.callbackOnSuccess.call(this);
            }

        };



        /****************************
        getAccountStatement
        ****************************/
        this.getAccountStatement = function (params) {
            var request = new gec.IAPIRequest(params);
            request.sessionToken = gecPrivate.sessionToken;
            request.postingTypes = params.postingTypes;
            request.startTime = params.startTime;
            request.endTime = params.endTime;
            request.language = controllerDefaults.language || "en";
            request.startOffset = params.startOffset;
            request.numberToReturn = params.numberToReturn;
            request.groupByClientGroupReference = params.groupByClientGroupReference;
            request.embedGroupedPostings = params.embedGroupedPostings;

            this.sendRequest('/GetAccountStatement.ashx', request, _getAccountStatementResponse);
        };
        var _getAccountStatementResponse = function (request, response) {

            if (response.returnCode != 0) {
                gecPrivate.checkExpiredSession(response.returnCode);
                request.callbackOnException.call(this, new gec.AsyncException(response));
            } else {
                var xmlDoc, posting;
                if (response.postings != null) {
                    for (var i = 0; i < response.postings.length; i++) {
                        posting = response.postings[i];

                        var reference = posting.reference;
                        var description = "";
                        if (posting.description === "") {
                            const referenceElement = new DOMParser().parseFromString(reference, "text/xml").querySelector("posting");
                            if (referenceElement && referenceElement.getAttribute("oh") !== null) {
                              let selections = "";
                              const sElements = referenceElement.getElementsByTagName("s");
                              for (let j = 0; j < sElements.length; j++) {
                                const s = sElements[j];
                                if (s.getAttribute("en") !== null) {
                                    selections += String.format("<li>{0} - {1} - {2}</li>", s.getAttribute("en"), s.getAttribute("mn"), s.getAttribute("sn"));
                                }
                              }
                              const length = (reference.match(/<s/g) || []).length;
                              if (length > 1) {
                                description = String.format(
                                    "{0}: {1} [{2}]<ul>{3}</ul>",
                                    referenceElement.getAttribute("oc"),
                                    (referenceElement.getAttribute("p") === "1") ? "Back" : "Lay",
                                    referenceElement.getAttribute("oh"),
                                    selections
                                );
                              } else {
                                description = String.format(
                                    "{0}: {1} ({2})",
                                    referenceElement.getAttribute("oc"),
                                    (referenceElement.getAttribute("p") === "1") ? "Back" : "Lay",
                                    referenceElement.getAttribute("oh")
                                );
                              }
                            } else {
                              description = reference;
                            }
                        }
                        else {
                            if (posting.postingType == 4 || posting.postingType == 5) {
                                if (posting.reference && posting.reference.indexOf("<") === 0) {
                                    // Reference is (probably) XML
                                    xmlDoc = gec.loadXmlDocument(posting.reference);
                                    if (xmlDoc != undefined && xmlDoc.documentElement !== null) {
                                        description = xmlDoc.documentElement.getAttribute("ftmrNickname")
                                            + " - "
                                            + xmlDoc.documentElement.getAttribute("fundsTransferMethodName");
                                    } else {
                                        description = posting.description;  // e.g. PayNearMe deposit (for NYRA)
                                    }
                                } else {
                                    description = posting.description;  // e.g. PayNearMe deposit (for NYRA)
                                }
                            } else {
                                description = response.postings[i].description.replace(/\</g, "&lt;");
                            }
                        }

                        response.postings[i].description = description;
                        response.postings[i].postingTypeId = response.postings[i].postingType;
                    }

                }
                request.callbackOnSuccess.call(this, response);
            }
        };





        /****************************
        getExternalSystemToken
        ****************************/
        this.getExternalSystemToken = function (params) {
            var request = new gec.IAPIRequest(params);
            var currency;
            if (gecPrivate.userContext == null) {
                params.callbackOnException.call(this, { returnCode: 524 });
            }
            else {
                request.sessionToken = gecPrivate.sessionToken;
                request.externalSystemName = params.externalSystemName;
                request.nameValuePairs = params.nameValuePairs;
            }

            this.sendRequest('/GetExternalSystemToken.ashx', request, _getExternalSystemTokenResponse);
        };
        var _getExternalSystemTokenResponse = function (request, response) {
            if (response.returnCode != 0) {
                request.callbackOnException.call(this, { returnCode: response.returnCode });
            } else {
                gecPrivate.checkExpiredSession(response.returnCode);
                request.callbackOnSuccess.call(this, { token: response.token });
            }
        };



        /****************************
        getPunterDetails
        ****************************/
        this.getPunterDetails = function (params) {
            if (gecPrivate.userContext == null) {
                params.callbackOnException.call(this, { returnCode: 590 }); //	NeitherUserNorTelebetUserSession
            }
            else {
                var request = new gec.IAPIRequest(params);
                request.sessionToken = gecPrivate.sessionToken;
                this.sendRequest('/GetPunterDetails.ashx', request, _getPunterDetailsResponse);
            }
        };
        var _getPunterDetailsResponse = function (request, response) {
            if (response.returnCode != 0) {
                request.callbackOnException.call(this, new gec.AsyncException(response));
            } else {

                var returnObject = {};

                returnObject.partnerUsername = response.partnerUsername;
                returnObject.title = response.title;
                returnObject.sex = response.sex;
                returnObject.name = response.name;
                returnObject.country = response.country;
                returnObject.address = response.address;
                returnObject.email = response.email;
                returnObject.phone = response.phone;
                returnObject.secondaryPhone = response.secondaryPhone;
                returnObject.firstQuestionType = response.firstQuestionType;
                returnObject.firstQuestionAnswer = response.firstQuestionAnswer;
                returnObject.secondQuestionType = response.secondQuestionType;
                returnObject.secondQuestionAnswer = response.secondQuestionAnswer;
                returnObject.birthDate = response.birthDate;
                returnObject.isContactAllowed = response.isContactAllowed;
                returnObject.contactTypeId = response.contactType;
                returnObject.effectiveNumberOfCommissionPoints = response.effectiveNumberOfCommissionPoints;
                returnObject.commissionPointsEarnedThisWeek = response.commissionPointsEarnedThisWeek;
                returnObject.currency = response.currency;
                returnObject.reference = response.reference;
                returnObject.affiliateIdentifier = response.affiliateIdentifier;
                returnObject.whiteLabel = response.whiteLabel;
                returnObject.category = response.punterCategoryId || response.category; //remove this line eventually as categoryId is the correct one
                returnObject.categoryId = response.punterCategoryId || response.category;
                returnObject.punterCategoryName = response.punterCategoryName;
                returnObject.punterAccountId = response.punterAccountId;
                returnObject.activatedAt = response.activatedAt;
                returnObject.panNumber = response.panNumber;
                returnObject.originalRegistrationDate = response.originalRegistrationDate;

                request.callbackOnSuccess.call(this, returnObject);

            }
        };



        /****************************
        getPunterPreferences
        ****************************/
        this.getPunterPreferences = function (params) {
            if (gecPrivate.userContext == null) {
                params.callbackOnException.call(this, { returnCode: 590 });
            }
            else {
                var request = new gec.IAPIRequest(params);
                request.sessionToken = gecPrivate.sessionToken;

                this.sendRequest('/GetPunterPreferences.ashx', request, _getPunterPreferencesResponse);
            }
        };
        var _getPunterPreferencesResponse = function (request, response) {
            if (response.returnCode != 0) {
                request.callbackOnException.call(this, { returnCode: response.returnCode });
            } else {

                var returnObject = {};


                returnObject.priceFormat = response.priceFormat;
                if (response.marketByVolumeAmount != null)
                    returnObject.marketByVolumeAmount = response.marketByVolumeAmount.amount;
                else
                    returnObject.marketByVolumeAmount = 0;
                returnObject.language = response.language;
                returnObject.forOrderRepriceOption = response.forOrderRepriceOption;
                returnObject.againstOrderRepriceOption = response.againstOrderRepriceOption;
                returnObject.includeSettledSelectionsInPAndL = response.includeSettledSelectionsInPAndL;
                if (response.normalMaximumLiability != null)
                    returnObject.normalMaximumLiability = response.normalMaximumLiability.amount;
                else
                    returnObject.normalMaximumLiability = null;
                if (response.maxPunterReservationPerMarket != null)
                    returnObject.maxPunterReservationPerMarket = response.maxPunterReservationPerMarket.amount;
                else
                    returnObject.maxPunterReservationPerMarket = null;
                returnObject.debitSportsbookStake = response.debitSportsbookStake;
                returnObject.debitExchangeStake = response.debitExchangeStake;


                request.callbackOnSuccess.call(this, returnObject);
            }
        };


        /****************************
        sendEmail
        ****************************/
        this.sendEmail = function (params) {
            var request = new gec.IAPIRequest(params);
            if (gecPrivate.sessionToken != null)
                request.sessionToken = gecPrivate.sessionToken;
            else
                request.integrationPartnerId = gecPrivate.controllerDefaults.integrationPartnerId;

            request.subject = params.subject;
            request.content = params.content;
            request.targetCode = params.targetCode;
            request.sendersEmailAddress = params.sendersEmailAddress;
            request.isContentHTML = params.isContentHTML;


            this.sendRequest('/sendEmail.ashx', request, _sendEmailResponse);
        };
        var _sendEmailResponse = function (request, response) {
            if (response.returnCode != 0) {
                request.callbackOnException.call(this, new gec.AsyncException(response));
            } else {
                request.callbackOnSuccess.call(this, response);
            }
        };

        /****************************
        addPunterTaggedValue
        ****************************/
        this.addPunterTaggedValue = function (params) {

            if (gecPrivate.userContext == null) {
                params.callbackOnException.call(this, { returnCode: 590, message: "NeitherUserNorTelebetUserSession" });
            } else {
                var request = new gec.IAPIRequest(params);
                request.sessionToken = gecPrivate.sessionToken;
                request.name = params.name;
                request.value = params.value;
                request.taggedValues = params.punterTaggedValues || params.taggedValues;
                this.sendRequest('/AddPunterTaggedValue.ashx', request, _addPunterTaggedValueResponse);
            }
        };
        var _addPunterTaggedValueResponse = function (request, response) {
            if (response.returnCode != 0) {
                if (request.callbackOnException !== undefined) {
                    request.callbackOnException.call(this, new gec.AsyncException(response));
                }
            } else {
                if (request.callbackOnSuccess !== undefined) {
                    request.callbackOnSuccess.call(this, response);
                }
            }
        };

        /****************************
        deletePunterTaggedValue
        ****************************/
        this.deletePunterTaggedValue = function (params) {

            if (gecPrivate.userContext == null) {
                params.callbackOnException.call(this, { returnCode: 590, message: "NeitherUserNorTelebetUserSession" });
            } else {
                var request = new gec.IAPIRequest(params);
                request.sessionToken = gecPrivate.sessionToken;
                request.name = params.name;
                this.sendRequest('/DeletePunterTaggedValue.ashx', request, _deletePunterTaggedValueResponse);
            }
        };
        var _deletePunterTaggedValueResponse = function (request, response) {
            if (response.returnCode != 0) {
                request.callbackOnException.call(this, new gec.AsyncException(response));
            } else {
                request.callbackOnSuccess.call(this, response);
            }
        };


        /****************************
        getPunterTaggedValue
        ****************************/
        this.getPunterTaggedValue = function (params) {

            if (gecPrivate.userContext == null) {
                params.callbackOnException.call(this, { returnCode: 590, message: "NeitherUserNorTelebetUserSession" });
            } else {
                var request = new gec.IAPIRequest(params);
                request.sessionToken = gecPrivate.sessionToken;
                request.name = params.name;

                this.sendRequest('/GetPunterTaggedValue.ashx', request, _getPunterTaggedValueResponse);
            }
        };
        var _getPunterTaggedValueResponse = function (request, response) {
            if (response.returnCode != 0) {
                request.callbackOnException.call(this, new gec.AsyncException(response));
            } else {
                request.callbackOnSuccess.call(this, { value: response.value });
            }
        };
        /****************************
        listPunterTaggedValues
        ****************************/
        this.listPunterTaggedValues = function (params) {

            if (gecPrivate.userContext == null) {
                params.callbackOnException.call(this, { returnCode: 590, message: "NeitherUserNorTelebetUserSession" });
            } else {
                var request = new gec.IAPIRequest(params);
                request.sessionToken = gecPrivate.sessionToken;
                request.searchCriteria = params.searchCriteria;
                request.searchStrings = params.searchStrings;

                this.sendRequest('/ListPunterTaggedValues.ashx', request, _listPunterTaggedValuesResponse);
            }
        };
        var _listPunterTaggedValuesResponse = function (request, response) {
            if (response.returnCode != 0) {
                request.callbackOnException.call(this, new gec.AsyncException(response));
            } else {
                request.callbackOnSuccess.call(this, response.taggedValues || []);
            }
        };


        /****************************
        geo-location functionality
        ****************************/

        this.getLocationPermission = function () {

            var cookieValue = gecPrivate._base.getCookie("geoLocationPermission");

            if (cookieValue === "") {
                cookieValue = "never_asked";
            }

            return cookieValue;
        }

        this.getBrowserGeoLocation = function (callbackOnComplete) {

            if (navigator.geolocation) {

                navigator.geolocation.getCurrentPosition(

                    function (currentPosition) {

                        gecPrivate._base.setCookie("geoLocationPermission", "granted", 9999, gecPrivate.sameSiteValueForCookies);

                        callbackOnComplete.call(this, currentPosition.coords);
                    },

                    function (error) {

                        if (error.code === error.PERMISSION_DENIED) {
                            gecPrivate._base.setCookie("geoLocationPermission", "denied_relevant_state", 9999, gecPrivate.sameSiteValueForCookies);
                        }

                        callbackOnComplete.call(this, undefined);
                    }

                );

            } else {

                callbackOnComplete.call(this, undefined);
            }

        }

        this.isLocationRequiredForEstablishSession = function (request) {

            var performCustomServiceParams = {};


            performCustomServiceParams.customServiceName = "nyra.IsLocationRequiredForEstablishSession";
            performCustomServiceParams.nameValuePairs = [{
                name: "username",
                value: request.partnerUsername
            }, {
                name: "granularChannelType",
                value: String(request.granularChannelType)
            }];
            performCustomServiceParams.isLoginAfterSuccessfulRegistration = request.isLoginAfterSuccessfulRegistration;
            performCustomServiceParams.callbackOnSuccess = function (response) {

                var locationIsRequired = false;

                if (response.nameValuePairs.length === 1) {
                    locationIsRequired = (response.nameValuePairs[0].value.toLowerCase() === "true");
                }

                request.callbackOnSuccess.call(this, {
                    locationIsRequired: locationIsRequired
                });

            };
            performCustomServiceParams.callbackOnException = request.callbackOnException;

            this.performCustomService(performCustomServiceParams);
        };



        /****************************
        listFreeBetEntitlements
        ****************************/

        this.listFreeBetEntitlements = function (params) {

            var request;

            if (gecPrivate.userContext == null) {
                params.callbackOnException.call(this, { returnCode: 590, message: "NeitherUserNorTelebetUserSession" });
            } else {
                request = new gec.IAPIRequest(params);
                request.sessionToken = gecPrivate.sessionToken;
                request.statusFilter = params.statusFilter;
                this.sendRequest('/ListFreeBetEntitlements.ashx', request, function (request, response) {
                    var returnObject = [];
                    if (response.returnCode != 0) {
                        request.callbackOnException.call(this, { "returnCode": response.returnCode });
                    } else {
                        for (var bet in response.freeBetEntitlements) {
                            response.freeBetEntitlements[bet].amountAwarded = response.freeBetEntitlements[bet].amountAwarded.amount;
                            response.freeBetEntitlements[bet].amountRemaining = response.freeBetEntitlements[bet].amountRemaining.amount;
                            response.freeBetEntitlements[bet].applicableForSBMultipleBets = response.freeBetEntitlements[bet].applicableForSBMultipleBets;
                            for (var order in response.freeBetEntitlements[bet].orders) {
                                response.freeBetEntitlements[bet].orders[order].totalForSideStake = response.freeBetEntitlements[bet].orders[order].totalForSideStake.amount;
                                response.freeBetEntitlements[bet].orders[order].totalRiskedAmount = response.freeBetEntitlements[bet].orders[order].totalRiskedAmount.amount;

                            }
                            if (response.freeBetEntitlements[bet].sbMultipleBets && response.freeBetEntitlements[bet].sbMultipleBets.length) {
                                for (var sbMultipleBet in response.freeBetEntitlements[bet].sbMultipleBets) {
                                    response.freeBetEntitlements[bet].sbMultipleBets[sbMultipleBet].sBMultipleBetTotalStake = response.freeBetEntitlements[bet].orders[sbMultipleBet].sBMultipleBetTotalStake.amount;
                                    response.freeBetEntitlements[bet].sbMultipleBets[sbMultipleBet].sBMultipleBetPlacedAt = response.freeBetEntitlements[bet].orders[sbMultipleBet].sBMultipleBetPlacedAt;
                                    response.freeBetEntitlements[bet].sbMultipleBets[sbMultipleBet].sBMultipleBetId = response.freeBetEntitlements[bet].orders[sbMultipleBet].sBMultipleBetId;
                                }
                            }

                        }
                        if (response.freeBetEntitlements != null)
                            returnObject = response.freeBetEntitlements;

                        request.callbackOnSuccess.call(this, returnObject);
                    }
                });
            }
        };

        /****************************
        selfDeletePunter
        ****************************/
        this.selfDeletePunter = function (params) {
            if (gecPrivate.userContext == null) {
                params.callbackOnException.call(this, { returnCode: 590, message: "NeitherUserNorTelebetUserSession" });
            }
            else {
                var request = new gec.IAPIRequest(params);

                request.sessionToken = gecPrivate.sessionToken;
                request.existingCleartextPassword = params.existingCleartextPassword;

                this.sendRequest('/SelfDeletePunter.ashx', request, _selfDeletePunterResponse);
            }
        };
        var _selfDeletePunterResponse = function (request, response) {
            if (response.returnCode === 0) {
                request.callbackOnSuccess.call(this, {});
            } else {
                gecPrivate.checkExpiredSession(response.returnCode);
                request.callbackOnException.call(this, response);
            }

        };

        /****************************
        validatePromotionCode
        ****************************/
        this.validatePromotionCode = function (params) {
            var request = new gec.IAPIRequest(params);

            if (gecPrivate.sessionToken != null) {
                request.sessionToken = gecPrivate.sessionToken;
            } else {
                request.whiteLabel = params.whiteLabel;
            }

            request.promoCode = params.promoCode;
            request.promotionType = params.promotionType;

            this.sendRequest('/ValidatePromotionCode.ashx', request, _validatePromotionCodeResponse);
        };
        var _validatePromotionCodeResponse = function (request, response) {
            if (response.returnCode !== 0) {
                request.callbackOnException.call(this, new gec.AsyncException(response));
            } else {
                request.callbackOnSuccess.call(this, response);
            }
        };

        this.sendRequest = this.makeAjaxRequest;

        var setParameters = function (config) {

            if (config.logClientEntries != undefined) {
                _logClientEntries = config.logClientEntries;
            }

            if (config.apisNotToBeSentClientLogging != undefined) {
                _apisNotToBeSentClientLogging = config.apisNotToBeSentClientLogging;
            }

            if (config.numberOfGetRacesCallsToLog != undefined) {
                gecPrivate.numberOfGetRacesCallsToLog = config.numberOfGetRacesCallsToLog;
            }

            if (config.numberOfRaceStatusUpdatesToLog != undefined) {
                gecPrivate.numberOfRaceStatusUpdatesToLog = config.numberOfRaceStatusUpdatesToLog;
            }

            if (config.numberOfPoolStatusUpdatesToLog != undefined) {
                gecPrivate.numberOfPoolStatusUpdatesToLog = config.numberOfPoolStatusUpdatesToLog;
            }

            if (config.pushHealthcheck != undefined)
                _pushHealthcheck = config.pushHealthcheck;

            if (config.streamingConnectionDetails != undefined) {
                _thisController.streamingConnectionDetails = config.streamingConnectionDetails;
                if (gecPrivate.disableStreamingInitialisation !== true) {
                    _thisController.isStreamingEnabled = true;
                }
            }

            if (config.queueing !== undefined) {
                _queueingGECSystemParams.adjustWaitTimeInSeconds = config.queueing.adjustWaitTimeInSeconds;
            }

            gecPrivate._maxBootstrapFailedAttempts = config.bootstrapAttempts || 10;

            var b = gecPrivate._base.BrowserDetect.browser;
            var bv = b + gecPrivate._base.BrowserDetect.version;
            var os = gecPrivate._base.BrowserDetect.OS;
            var osb = os + "-" + b;

            if (config.streamingExcludedBrowsers != null) {
                if (config.streamingExcludedBrowsers[os] && ((config.streamingExcludedBrowsers[osb] == undefined) || (config.streamingExcludedBrowsers[osb] == true))) {
                    delete _thisController.streamingConnectionDetails;
                    _thisController.isStreamingEnabled = false;
                }

                if (config.streamingExcludedBrowsers[b] && ((config.streamingExcludedBrowsers[bv] == undefined) || (config.streamingExcludedBrowsers[bv] == true))) {
                    delete _thisController.streamingConnectionDetails;
                    _thisController.isStreamingEnabled = false;
                }

                if (config.streamingExcludedBrowsers[osb] && ((config.streamingExcludedBrowsers[bv] == undefined) || (config.streamingExcludedBrowsers[bv] == true))) {
                    delete _thisController.streamingConnectionDetails;
                    _thisController.isStreamingEnabled = false;
                }
            }


            if (config.storeSessionTokenInCookieWithExpiryTime != undefined)
                _storeSessionTokenInCookieWithExpiryTime = config.storeSessionTokenInCookieWithExpiryTime;

            if (config.cookieRefreshRate != undefined)
                _cookieRefreshRate = config.cookieRefreshRate;

            if (config.cookieTimeout != undefined)
                _cookieTimeout = config.cookieTimeout;

            if (config.topLevelId != undefined)
                _topLevelId = config.topLevelId;

            if (config.pollChangedOrdersTime != undefined)
                gecPrivate.pollChangedOrdersTime = config.pollChangedOrdersTime;

            if (config.eventCacheRefreshRate != undefined)
                _eventCacheRefreshRate = config.eventCacheRefreshRate;

            if (config.aapiVersion != undefined)
                _aapiVersion = config.aapiVersion;

            if (config.pingInterval != undefined)
                _pingInterval = config.pingInterval;

        }

        function completeGECInitialisation() {

            if (typeof _params.profile == "string") {
                var gecSystemParamsGTVName = String.format("GEC.I{0}P{1}.{2}.SystemParams", _params.integrationPartnerId, _params.pseudoIntegrationPartnerId || 0, _params.profile);
                var iapiQueueingSettingsGTVName = "IAPI.Queueing.Settings";

                gecPrivate._base.BrowserDetect.init();

                function replaceWhitelabelDomain(aString) {
                    return aString.replace(/\[whitelabeldomain\]/g, _params.whitelabelDomain);
                }

                _thisController.listGenericTaggedValues({
                    searchStrings: [
                        gecSystemParamsGTVName,
                        iapiQueueingSettingsGTVName
                    ],
                    callbackOnSuccess: function (gtvs) {
                        if ((gtvs != null) && (gtvs.length)) {

                            gtvs.forEach(function (gtv) {
                                switch (gtv.name) {
                                    case gecSystemParamsGTVName:
                                        var value = replaceWhitelabelDomain(gtv.value);
                                        var parsedValue;
                                        try {
                                            parsedValue = JSON.parse(value);
                                        } catch (ex) {
                                            console.warn("Incorrect JSON format (possibly missing quotes on property names):" + gecSystemParamsGTVName);
                                            console.warn(gtv.value);
                                            parsedValue = GBEJSON.parse(value);
                                        }
                                        setParameters(parsedValue);
                                        break;
                                    case iapiQueueingSettingsGTVName:
                                        try {
                                            _queueingIAPISettings = JSON.parse(gtv.value);
                                        } catch (ex) {
                                            console.warn("Incorrect JSON format (possibly missing quotes on property names):" + iapiQueueingSettingsGTVName);
                                            console.warn(gtv.value);
                                            _queueingIAPISettings = GBEJSON.parse(value);
                                        }
                                        break;
                                }
                            });

                        }

                        _thisController._init();

                    },
                    callbackOnException: function (resp) {
                        _thisController._init();
                    }
                });
            } else {
                if (typeof _params.profile == "object") {
                    setParameters(_params.profile);
                    if (_params.iapiQueuingSettings) {
                        _queueingIAPISettings = _params.iapiQueuingSettings
                    }
                    _thisController._init();

                } else {
                    _thisController._init();
                }

            }
        }

        completeGECInitialisation();


        var _regexArrayCommon = [
            { regex: /(\d{1,4})\/D\S60.*$/, method: _onSetRefreshPeriod },
            { regex: /(\d{1,4})\/D\S61.*$/, method: _onGetRefreshPeriod }];

        gecPrivate._regexArray = (gecPrivate._regexArray || []).concat(_regexArrayCommon);


    };

    gec.Controller.prototype.unsubscribe = function (params) {
        var correlationId = gecPrivate.addToCorrelation(params)

        var request = {};
        request[0] = correlationId;

        if (params.subscriptionIds != null) {
            request[1] = '';
            for (var subI = 0; subI < params.subscriptionIds.length; subI++) {
                request[1] += params.subscriptionIds[subI] + '~';
            }
            request[1] = request[1].substr(0, request[1].length - 1);
        }

        gecPrivate.addToPushMessages(request);
        gecPrivate._sendStreamingMessage(20, request);
        return correlationId;
    };

    gec.Controller.prototype.logonPunter = function (params) {
        var correlationId = gecPrivate.addToCorrelation(params)

        var request = {};

        if (!this.isStreamingEnabled) {
            window.setTimeout(params.callbackOnSuccess, 100);
            return;
        }

        request[0] = correlationId;

        if (params.partnerToken != null) {
            request[1] = params.partnerToken;
        } else if (params.aAPISessionToken != null) {
            request[2] = params.aAPISessionToken;
        } else if (params.cleartextPassword != null) {

            if (params.integrationPartnerId != null)
                request[3] = params.integrationPartnerId;

            request[4] = params.partnerUsername;
            request[5] = params.cleartextPassword;
            request[6] = gecPrivate.userContext.currency;
            request[7] = params.language;

        } else {
            request[14] = gecPrivate.controllerDefaults.integrationPartnerId;
            request[15] = gecPrivate.sessionToken;
        }

        request[8] = gecPrivate._aapiVersion;
        request[9] = gecPrivate._base.createUUID();

        //gec.GranularChannelType.InternetBrowser
        request[10] = params.granularChannelType || gec.GranularChannelType.InternetBrowser;
        request[12] = params.channelInformation || "";

        //optional
        if (params.clientIdentifier !== undefined) {
            request[13] = params.clientIdentifier.replace("{gecversion}", gecPrivate._version.implementationVersion);
        }

        if (gecPrivate._debug) { gecPrivate._base.log('logonPunter'); }

        // Clear the healthcheck interval in order to start it again with the user logged in
        gecPrivate.stopPushHealthcheckTimer();
        gecPrivate.addToPushMessages(request);
        gecPrivate._sendStreamingMessage(2, request);

        return correlationId;
    }

    gec.Controller.prototype.logoffPunter = function (params) {
        var correlationId = gecPrivate.addToCorrelation(params)

        gecPrivate._pushHealthcheck.user = {};
        // Stop the healthcheck for this user, but if the healthcheck is enabled for anonymous 
        // users then it will restart with the generic values
        gecPrivate.stopPushHealthcheckTimer();

        var request = {};
        request[0] = correlationId;

        // Clear the healthcheck interval in order to start it again with the user logged out
        gecPrivate.addToPushMessages(request);
        gecPrivate._sendStreamingMessage(3, request);

    }

    gec.Controller.prototype.setAnonymousSessionContext = function (params) {
        if (!this.isStreamingEnabled) {
            window.setTimeout(params.callbackOnSuccess, 100);
            return;
        }
        var correlationId = gecPrivate.addToCorrelation(params)

        var request = {
            0: correlationId,
            1: params.currency,
            2: params.language,
            3: params.priceFormat,
            4: false,
            6: gecPrivate._aapiVersion,
            7: gecPrivate._base.createUUID(),
            8: params.granularChannelType || gec.GranularChannelType.InternetBrowser,
            9: params.channelInformation || ""
        };

        if (params.clientIdentifier !== undefined) {
            request[10] = params.clientIdentifier.replace("{gecversion}", _version.implementationVersion);
        }

        if ((params.integrationPartnerId != null) || (gecPrivate.controllerDefaults.integrationPartnerId != null))
            request[5] = params.integrationPartnerId || gecPrivate.controllerDefaults.integrationPartnerId;

        if (gecPrivate._debug) { gecPrivate._base.log('setAnonymousSessionContext'); }

        gecPrivate._sendStreamingMessage(1, request);

    }


    gec.IAPIRequest = function (params, requiredParams) {
        this.header = gecPrivate._GBEHeader;

        if (requiredParams !== undefined) {
            Object.keys(requiredParams).forEach(function (paramName) {
                if (params[paramName] === undefined) {
                    console.error({ "number": 134, "message": "required params not included:" + paramName });
                }
            });
        }
        if (params != null) {
            this.callbackOnException = params.callbackOnException;
            this.callbackOnSuccess = params.callbackOnSuccess;
        }
    };
    GBERequestHeader = function () {
        this.version = 2;
        this.fragmentLanguage = "Javascript";
        this.fragmentVersion = "";
    };
    gec.SortOnDisplayOrder = function (a, b) {
        return a.displayOrder - b.displayOrder;
    };
    gec.SortOnIssuedAt = function (a, b) {
        return (com.globalbettingexchange.base.jsDate(b.issuedAt) > com.globalbettingexchange.base.jsDate(a.issuedAt)) ? -1 : 1;
    };
    gec.SortOnPlacedAt = function (a, b) {
        return (com.globalbettingexchange.base.jsDate(b.placedAt) > com.globalbettingexchange.base.jsDate(a.placedAt)) ? -1 : 1;
    };
    gec.SortOnMultiplebetId = function (a, b) {
        return (b.multipleBetId > a.multipleBetId) ? -1 : 1;
    };
    gec.SortOnStartTime = function (a, b) {
        if ((a.startTime == null) || (b.startTime == null)) {
            return -1;
        }
        return (com.globalbettingexchange.base.jsDate(b.startTime) < com.globalbettingexchange.base.jsDate(a.startTime)) ? 1 : -1;
    };
    gec.SortOnStartingAt = function (a, b) {
        if ((a.startingAt == null) || (b.startingAt == null)) {
            return -1;
        }
        return (com.globalbettingexchange.base.jsDate(b.startingAt) < com.globalbettingexchange.base.jsDate(a.startingAt)) ? 1 : -1;
    };
    gec.SortOnChangedAt = function (a, b) {
        if ((a.sequenceNumber == null) || (b.sequenceNumber == null)) {
            return 1;
        }
        return a.sequenceNumber - b.sequenceNumber;
    };
    createAjaxObject = function () {
        return (window.XMLHttpRequest) ? new XMLHttpRequest() : new ActiveXObject('MSXML2.XMLHTTP');
    };
    urlencode = function (str) {
        str = encodeURIComponent(str);
        str = str.replace(/\+/g, "%2B");
        str = str.replace('%20', '+');
        str = str.replace('*', '%2A');
        str = str.replace(/\'/g, '%27');
        str = str.replace('@', '%40');
        return str;
    };
    getReturnCodeName = function (rc) {

        var name = 'UnknownReturnCode';
        switch (rc * 1) {
            case 0: name = 'Success'; break;
            case 1: name = 'ResourceError'; break;
            case 2: name = 'SystemError'; break;
            case 5: name = 'EventClassifierDoesNotExist'; break;
            case 8: name = 'MarketDoesNotExist'; break;


            case 011: name = 'SelectionDoesNotExist'; break;
            case 015: name = 'MarketNotActive'; break;
            case 017: name = 'SelectionNotActive'; break;
            case 022: name = 'NoUnmatchedAmount'; break;
            case 023: name = 'CurrencyNotValid'; break;
            case 025: name = 'PunterReservationPerMarketExceeded'; break;
            case 114: name = 'ResetHasOccurred'; break;
            case 128: name = 'TradingCurrentlySuspended'; break;
            case 131: name = 'InvalidPrice'; break;
            case 136: name = 'WithdrawalSequenceNumberIsInvalid'; break;
            case 137: name = 'MaximumInputRecordsExceeded'; break;
            case 208: name = 'PunterSuspended'; break;
            case 240: name = 'PunterProhibitedFromPlacingOrders'; break;
            case 241: name = 'InsufficientPunterFunds'; break;
            case 255: name = 'DepositWouldExceedPunterLimit'; break
            case 271: name = 'OrderAPIInProgress'; break;
            case 302: name = 'PunterIsSuspendedFromTrading'; break;
            case 305: name = 'ExpiryTimeInThePast'; break;
            case 314: name = 'PunterRestrictedFromAgainstSideOrders'; break;
            case 315: name = 'PunterRestrictedFromForSideOrders'; break;
            case 316: name = 'PunterRestrictedToFillKillOrders'; break;
            case 406: name = 'PunterIsBlacklisted'; break;
            case 473: name = 'ThresholdSpecifiedTooSmall'; break;
            case 477: name = 'UnmatchedOrderCouldResult'; break;
            case 486: name = 'ExpiredTAndCVersion'; break;
            case 493: name = 'PICPunterNotKnown'; break;
            case 494: name = 'PICPunterNotActive'; break;
            case 495: name = 'PICInsufficientFunds'; break;
            case 496: name = 'PICSystemError'; break;
            case 497: name = 'PICCurrencyNotValid'; break;
            case 498: name = 'PICUnavailable'; break;
            case 555: name = 'IsLineBetting '; break;
            case 591: name = 'DefaultsNotLoaded'; break;
            case 592: name = 'OrderCacheNotPresent'; break;
            case 597: name = 'MarketIsForRealMoney'; break;
            case 598: name = 'MarketIsForPlayMoney'; break;
            case 617: name = 'PunterRestrictedToFillKillDangerballOrde'; break;

            case 596: name = 'StakeOutsideAcceptableRange'; break;
            case 597: name = 'MarketIsForRealMoney'; break;
            case 598: name = 'MarketIsForPlayMoney'; break;
            case 599: name = 'MarketIsForPlay'; break;
            case 600: name = 'PunterHasPlayCurrency'; break;
            case 610: name = 'RequestDidNotAuthenticate'; break;
            case 612: name = 'PunterNotAuthenticated'; break;
            case 613: name = 'IntegrationPartnerIsStandalone'; break;
            case 614: name = 'IntegrationPartnerIsNotStandalone'; break;
            case 615: name = 'APIIsDeprecated'; break;
            case 616: name = 'PunterHasRealCurrency'; break;
            case 617: name = 'CurrentlyUserSession'; break;
            case 618: name = 'EventCacheNotPresent'; break;
            case 628: name = 'MarketNotEnabledForSPBetting'; break;
            case 629: name = 'PunterSPStakeLimitExceeded'; break;
            case 631: name = 'SPBetDoesNotExist'; break;
            case 638: name = 'MobileApplicationNotSupported'; break;
            case 643: name = 'PunterRestrictedToFillKillDangerballOrders'; break;
            case 671: name = 'ConcurrentSessionLimitReached '; break;
            case 672: name = 'ConnectionInInvalidState'; break;
            case 675: name = 'PunterIsBanned'; break;
            case 643: name = 'PunterRestrictedToFillKillDangerballOrde'; break;
            case 644: name = 'InsufficientFreeBetStakeAvailable '; break;
            case 663: name = 'RestrictedToTakeBackOrders'; break;
            case 664: name = 'RestrictedToMMOrders'; break;
            case 665: name = 'RestrictedFromMarket'; break;
            case 670: name = 'RestrictedToMakeOrders'; break;
            case 672: name = 'ConnectionInInvalidState'; break;
            case 673: name = 'PunterNotAuthorisedForAAPI'; break;
            case 900: name = 'LocationNotSpecified'; break;
            case 956: name = 'ContestEntrantsNotAllowed'; break;
            case 957: name = 'PunterNotContestEntrant'; break;
            case 974: name = 'NoCurrentContestForPunter'; break;
        }
        return name;
    };
    gec.loadXmlDocument = function (xmlString) {
        var xDoc;

        if (typeof window.DOMParser != "undefined") {
            var parser = new DOMParser(); //Chrome
            xDoc = parser.parseFromString(xmlString, "text/xml");

        } else if (window.ActiveXObject) {
            xDoc = new ActiveXObject("Microsoft.XMLDOM");
            xDoc.loadXML(xmlString); //IE

        } else if (document.implementation && document.implementation.createDocument) {
            xDoc = document.implementation.createDocument("", "", null);
            if (xDoc.loadXML != null) {
                xDoc.loadXML(xmlString); // Mozilla
            }
        }

        return xDoc;

    };



    /*****************************
    Object Definitions
    *****************************/


    gec.AsyncException = function (params) {//BaseType
        this.message;
        this.name;
        this.returnCode;
        this.correlationId;

        if (params != null) {
            this.message = params.message;
            this.name = params.name;
            this.returnCode = params.returnCode;
            this.correlationId = params.returnCode;
        }

    };
    gec.AuthenticationType = function (params) {//BaseType
        this.id;
        this.name;
    };
    gec.BallotOutAction = function (params) {//BaseType
        this.id;
        this.name;
    };

    gec.Blurb = function (params) {//BaseType - String
    };

    gec.ClientMetricType = function (params) {//BaseType
        this.id;
        this.name;
    };

    gec.StartingSoonEvent = function (market) {

        var _thisEventClassifier = market.getEventClassifier();

        this.startingAt = market.startTime;
        this.fireOnChange; // function()

        //methods
        this.getStartingSoonMarkets = function () {

            var currentTime = new Date();

            var hrs = currentTime.getUTCHours();
            hrs -= 12; //go back 12 hours
            currentTime.setUTCHours(hrs);
            var allMarkets = _thisEventClassifier.getMarkets();
            var markets = [];
            for (var j in allMarkets) {
                if ((gecPrivate._base.jsDate(allMarkets[j].startTime) > currentTime) && !allMarkets[j].currentlyInRunning) {

                    if (allMarkets[j].startTime == this.startingAt)
                        markets[markets.length] = allMarkets[j];
                }
            }
            return markets;
        };
        this.getEventClassifier = function () { return _thisEventClassifier; };

    };
    gec.Currency = function (params) {//BaseType
    };
    gec.EntityType = function (params) {
        this.id;
        this.name;
    };

    Icon = function (params) {//string
    };
    gec.InRunningEvent = function (market, sport) {
        var _thisEventClassifier = market.getEventClassifier();

        this.fireOnChange;
        this.getEventClassifier = function () { return _thisEventClassifier; };
        this.getInRunningMarkets = function () {
            var markets = [];
            var thisEventAllMarkets = _thisEventClassifier.getMarkets();

            for (var j = 0; j < thisEventAllMarkets.length; j++) {
                if (thisEventAllMarkets[j].currentlyInRunning)
                    markets[markets.length] = thisEventAllMarkets[j];
            }

            return markets;
        };
        this.getInRunningSport = function () { return sport; };
    };
    gec.InRunningSport = function (params, allMarkets, fromIAPI) {
        // Loop through the open and gets its topmost parent ie. the sport
        this.fireOnChange;

        if (fromIAPI) {
            this.getEventClassifier = function () { return params; };

            this.getInRunningEvents = function () {

                var events = [];
                return params.eventClassifiers;
            }

            return;
        }
        var _thisEventClassifier = params;
        while (_thisEventClassifier.getParent() != null) {
            _thisEventClassifier = _thisEventClassifier.getParent();
        }

        this.getEventClassifier = function () { return _thisEventClassifier; };
        this.getInRunningEvents = function () {

            var events = [];

            for (var j in allMarkets) {
                if (allMarkets[j].currentlyInRunning) {
                    //check if its in this sport and then return its parent event

                    var thisTopLevelEvent = allMarkets[j].getEventClassifier();

                    while (thisTopLevelEvent.getParent() != null) {
                        thisTopLevelEvent = thisTopLevelEvent.getParent();
                    }

                    if (_thisEventClassifier.eventClassifierId == thisTopLevelEvent.eventClassifierId) {
                        var inrunningEvent = new gec.InRunningEvent(allMarkets[j], this);
                        events[inrunningEvent.getEventClassifier().eventClassifierId] = inrunningEvent;
                    }
                }
            }

            var eventsToReturn = [];

            for (var ev in events) {
                eventsToReturn[eventsToReturn.length] = events[ev];
            }
            return eventsToReturn;

        };
    };
    gec.IntegrationPartnerParameters = function () {
        //Properties
        this.publicKey; //String (2048)
        this.pICPasswordOptionId; //integer (PICPasswordOption)
        this.interfaceVersionLevel; //String (256)
        this.allowableAuthenticationTypeId; //integer (AuthenticationType)
        this.allowAnonymousInteraction; //Boolean

        //Methods
        this.picPasswordOptionName = function () { return gec.picPasswordOptionName(this.pICPasswordOptionId); }
        this.allowableAuthenticationTypeName = function () { return gec.allowableAuthenticationTypeName(this.allowableAuthenticationTypeId); }
    };
    gec.LegDetail = function (params) {
        this.legId;
        this.sequence;
        this.isWin;

        this.numberWinningPlaces;
        this.numberPlacesIsFixed;
        this.eachWayAllowed;

        this.numberWinningPlaces;
        this.numberPlacesIsFixed;

        this.orderSignificant;
        this.minNumberSelections;

        this.maxNumberSelections;
        this.minNumberBankers;
        this.maxNumberBankers;
        this.race;
        this.runners;
    };
    gec.LocalBetStatus = {
        Active: 1, // The bet is active and has yet to be settled.
        SettledWon: 2, // The bet was settled with a payout amount greater than zero.
        SettledLost: 3, // The bet was settled with a payout of zero.
        SettledVoid: 10, // The bet was settled as 100 % void.
        CashedOut: 12
    };
    gec.LogEntryImportance = {
        Severe: 1,
        Warning: 2,
        Advice: 3,
        Info: 4,
        Fine: 5,
        Finest: 6
    };
    gec.Market = function (params) {
        //Properties
        this.marketId; //integer
        this.marketName; //String (256)
        this.marketType; //integer (MarketType)
        this.willBeInRunning; //Boolean
        this.currentlyInRunning; //Boolean
        this.isEnabledForMultipleBets; //Boolean
        this.isEnabledForEachWayBetting; //Boolean
        this.isEnabledForSPBetting; //Boolean
        this.startTime; //Timestamp//<optionally>
        this.eventClassifier;

        //private
        this.displayOrder;

        //Methods
        this.getStartingSoonEvent = function () { return; };
        this.getEventClassifier = function () { return; };
        this.getInRunningSport = function () { return; };
    };
    gec.MarketDetail = function (params) {
        //Properties
        this.marketId; //integer
        this.eventClassifierId;
        this.eventClassifierFullName; //String (256)
        this.marketName; //String (256)
        this.marketType; //integer(MarketType)
        this.isPlayMarket;
        this.placePayout; //Percentage
        this.canBeInRunning; //Boolean
        this.isCurrentlyInRunning; //Boolean
        this.numberOfWinningSelections; // integer
        this.startTime; //Timestamp<optionally>
        this.suspendTime; //Timestamp<optionally>
        this.marketStatusId; //integer (MarketStatus)
        this.withdrawalSequenceNumber; //integer
        this.isEnabledForMultipleBets; //Boolean
        this.isEnabledForEachWayBetting; //Boolean
        this.isEnabledForSPBetting; //Boolean
        this.selections = []; //Array of Selections[{}]

        //private
        this.displayOrder;

        //Methods
        this.getSelections = function () {
            return this.selections;
        }
        this.getPlaceFraction = function () {

            if (!this.isEachWayMarketType()) {
                return 0.0;
            }

            if (this.marketType == 21) {
                return Math.round(1 / this.numberOfWinningSelections * 100) / 100;
            }

            var competingSelectionCount = getCompetingSelectionCount(this);

            if (competingSelectionCount < 5) {
                return 1;
            }

            if (this.marketType == 19 && competingSelectionCount > 7) {
                return 0.2;
            }

            if (this.marketType == 20 && competingSelectionCount >= 8 && competingSelectionCount <= 11) {
                return 0.2;
            }

            return 0.25;
        }

        this.isEachWayMarketType = function () {
            return (this.marketType == 19 || this.marketType == 20 || this.marketType == 21);
        }

        var COMPETING_STATUSES = [2, 6, 7, 8];

        var getCompetingSelectionCount = function (m) {
            var count = 0;
            var status = 0;
            for (s in m.selections) {
                status = m.selections[s].selectionStatusId || m.selections[s].status;
                if (COMPETING_STATUSES[status] != null) {
                    count++;
                }
            }

            return count;
        }

    };
    gec.MarketTradingRestriction = function (params) {
        this.id;
        this.name;
    };
    gec.MarketType = function (params) {
        this.id;
        this.name;
    };
    gec.MoneyValue = function (params) {
    };
    gec.MultipleBet = function (params) {
        //Properties
        this.multipleBetId;
        this.selections = [];
        this.requestedStake;
        this.totalMatchedStake; this.requestedPrice;
        this.averageMatchedPrice;
        this.rolloverStake;
        this.numberOfUnsettledSelections;
        this.unsettledPrice;
        this.totalMaxUpside;
        this.multipleBetStatusId;
        this.placedAt;
        this.commissionRate;
        this.isFreeBet;
        this.totalCashOutAmount = params.totalCashOutAmount;
        this.totalCashOutStake = params.totalCashOutStake;

        this.iPAddress; //<optionally>
        this.ipCountryCode;
        this.channelInformation; //<optionally>

    };
    gec.MultipleBetDetail = function (params) {
        //Properties
        this.multipleBetId = params.multipleBetId;
        this.requestedStake = params.requestedStake;
        this.totalMatchedStake = params.totalMatchedStake;
        this.requestedPrice = params.requestedPrice;
        this.averageMatchedPrice = params.averageMatchedPrice;
        this.effectivePrice = params.effectivePrice;
        this.rolloverStake = params.rolloverStake;
        this.numberOfUnsettledSelections = params.numberOfUnsettledSelections;
        this.unsettledPrice = params.unsettledPrice;
        this.totalMaxUpside = params.totalMaxUpside;
        this.multipleBetStatusId = params.multipleBetStatusId;
        this.placedAt = params.placedAt;
        this.commissionRate = params.commissionRate;
        this.isFreeBet = params.isFreeBet;
        this.totalCashOutAmount = params.totalCashOutAmount;
        this.totalCashOutStake = params.totalCashOutStake;

        this.settledAt; // Timestamp<optionally>
        this.settlementAmount; // MoneyAmount
        this.matches = [];
        this.iPAddress = params.iPAddress;
        this.ipCountryCode = params.ipCountryCode;
        this.channelInformation = params.channelInformation;

    };
    gec.MultipleLegStatus = function (params) {
        this.id;
        this.name;
    };
    gec.PartnerTelebetToken = function (params) {
    };
    gec.PartnerToken = function (params) {
    };
    gec.PasswordToken = function (params) {
        this.header = gecPrivate._GBEHeader;
        this.callbackOnException = params.callbackOnException;
        this.callbackOnSuccess = params.callbackOnSuccess;
    };
    gec.Percentage = function (params) {
    };
    gec.Polarity = {
        For: 1,
        Against: 2
    };
    gec.PriceFormat = {
        Decimal: 1,
        Fractional: 2,
        American: 3
    };
    gec.PromotionType = {
        Normal: 1,
        RetentionPromotion: 2,
        SignOnPromotion: 3,
        ReferAFriend: 4,
        DepositBoost: 5
    };
    gec.MarketStatus = {
        Inactive: 1,
        Active: 2,
        Suspended: 3,
        Completed: 4,
        ResultsSet: 5,
        Settled: 6,
        Voided: 7
    };
    gec.OrderStatus = {
        Active: 1,
        Filled: 2,
        Expired: 3,
        Settled: 4,
        Void: 5,
        Suspended: 6
    };
    gec.FreeBetEntitlementStatus = {
        Active: 1,
        Rescinded: 2,
        Lapsed: 3,
        Used: 4
    };
    gec.PromotionStatus = {
        Inactive: 1,
        Upcoming: 2,
        Open: 3,
        Closed: 4,
        Completed: 5,
        Abandoned: 6
    };
    gec.SelectionDetail = function (params) {
        //Properties
        this.selectionId; // integer
        this.selectionName; // String (256)
        this.selectionIcon; // Icon<optionally>
        this.selectionIconIndex; // 
        this.selectionBlurb; // Blurb<optionally>
        this.selectionStatusId; // integer (SelectionStatus)
        this.selectionResetCount; // integer
        this.withdrawalFactor; // Percentage<optionally>

        this.forSportsbookPrices = []; // {SportsbookPrice}
        this.againstSportsbookPrices = []; // {SportsbookPrice}
        this.forExchangePrices = []; // [ExchangePrice]
        this.againstExchangePrices = []; // [ExchangePrice]
        this.market;

        if (params !== undefined) {
            this.selectionId = params.selectionId;
            this.selectionName = params.selectionName;
            this.selectionIcon = params.selectionIcon;
            this.selectionIconIndex = params.selectionIconIndex;
            this.selectionBlurb = params.selectionBlurb;
            this.selectionStatusId = params.status;
            this.selectionResetCount = params.selectionResetCount;
            this.withdrawalFactor = params.withdrawalSequenceNumber;
            this.market = params.market;
            this.currentForPrice = params.currentForPrice;
            this.currentAgainstPrice = params.currentAgainstPrice;
        }

    };

    gec.SelectionDetail.prototype.getAgainstExchangePrices = function () { return this.againstExchangePrices; };
    gec.SelectionDetail.prototype.getAgainstSportsbookPrices = function () { return this.againstSportsbookPrices; };
    gec.SelectionDetail.prototype.getForExchangePrices = function () { return this.forExchangePrices; };
    gec.SelectionDetail.prototype.getForSportsbookPrices = function () { return this.forSportsbookPrices; };
    gec.SelectionDetail.prototype.getMarket = function () { return this.market; };


    gec.SystemInteractionType = function (params) {

    };
    gec.TaxChargingBasis = function (params) {
        this.header = gecPrivate._GBEHeader;
        this.callbackOnException = params.callbackOnException;
        this.callbackOnSuccess = params.callbackOnSuccess;
    };
    gec.Timestamp = function (params) {
        this.header = gecPrivate._GBEHeader;
        this.callbackOnException = params.callbackOnException;
        this.callbackOnSuccess = params.callbackOnSuccess;
    };
    gec.TitleType = function (params) {
        this.header = gecPrivate._GBEHeader;
        this.callbackOnException = params.callbackOnException;
        this.callbackOnSuccess = params.callbackOnSuccess;
    };
    gec.TradeType = function (params) {
        this.header = gecPrivate._GBEHeader;
        this.callbackOnException = params.callbackOnException;
        this.callbackOnSuccess = params.callbackOnSuccess;
    };
    gec.UserContext = function () {
        //Properties
        this.partnerUsername = null; //String
        this.punterId = null; // Number
        this.debitSportsbookStake = null; //Boolean
        this.debitExchangeStake = null; //Boolean
        this.purseIntegraionModeId = null; //Number
        this.canPlaceForSideOrders = null; //Boolean
        this.canPlaceAgainstSideOrders = null; //Boolean
        this.canDeposit = null; //Boolean
        this.canWithdraw = null; //Boolean
        this.canPlaceOrders = null; //Boolean
        this.restrictedToFillKillOrders = null; //Boolean
        this.currency = null; //Currency
        this.language = null; //String
        this.priceFormat = null; //Number
        this.marketByVolumeAmount = null; //MoneyAmount 
        this.cohort = null; //String
        this.wageringCohort = null; //String
        this.state = null; //String
        this.zipcode = null; //String
        this.isRetailPunter = true;
        this.logonAttempts = []; // [{	attemptedAt: gec.Timestamp	punterIPAddress: string	logonSucceeded: boolean }]
        this.aDWPointsEarned; // Number
        this.isOnLegacyRegime; // Boolean
        this.contestRestriction;    // String
        this.contestCards;  // Array
        this.isASubPunter;  // Boolean

        //Methods
        this.priceFormatName = function () { return gec.priceFormatName(this.priceFormat); }
        this.purseIntegrationModeName = function () { return gec.purseIntegrationModeName(this.purseIntegraionModeId); }
    };
    gec.UserContextEnhanced = function () {
        //Properties
        this.partnerUsername = null; //String
        this.punterId = null; //Number
        this.debitSportsbookStake = null; //Boolean
        this.debitExchangeStake = null; //Boolean
        this.purseIntegraionModeId = null; //Number
        this.canPlaceForSideOrders = null; //Boolean
        this.canPlaceAgainstSideOrders = null; //Boolean
        this.canDeposit = null; //Boolean
        this.canWithdraw = null; //Boolean
        this.canPlaceOrders = null; //Boolean
        this.restrictedToFillKillOrders = null; //Boolean
        this.currency = null; //Currency
        this.language = null; //String
        this.priceFormat = null; //Number
        this.marketByVolumeAmount = null; //MoneyAmount 
        this.cohort = null; //String
        this.wageringCohort = null; //String
        this.state = null; //String 
        this.zipcode = null; //String 
        this.isRetailPunter;
        this.availableBalance;
        this.numberFreeBets;
        this.sumAmountRemaining;
        this.reserved;
        this.logonAttempts = []; // [{	attemptedAt: gec.Timestamp	punterIPAddress: string	logonSucceeded: boolean }]
        this.aDWPointsEarned; // Number
        this.isOnLegacyRegime; // Boolean
        this.contestRestriction;    // String
        this.contestCards;  // Array
        this.isASubPunter;  // Boolean
        this.hasASubPunter; // Boolean

    };

    gec.EventClassifier = function (params) {
        //Properties
        this.eventClassifierId = 1; //integer
        this.eventClassifierName = "ROOT"; //String (256)
        this.shortcutAllMarkets = false; //Boolean
        this.isEnabledForMultipleBets; //Boolean
        this.marketTypeIds; //Array[integer (marketTypeId)]

        var _parent = [];
        var _children = [];
        var _markets = [];

        this.displayOrder;

        this.getChildren = function () { return _children; };
        this.getMarkets = function () { return _markets; };
        this.getParent = function () { return _parent; };


    };
    gec.Title = {
        Mr: 1,
        Mrs: 2,
        Ms: 3,
        Dr: 4,
        Other: 5
    };

    gec.Sex = {
        Male: 1,
        Female: 2
    };

    gec.QuestionType = {
        PlaceOfBirth: 1,
        MothersMaidenName: 2,
        FirstSchool: 3,
        FavouriteColour: 4,
        FavouriteHolidayDestination: 5,
        AllTimeFavouriteJockey: 6,
        FavouriteAutomobile: 7,
        FirstPetsName: 8,
        AllTimeFavouriteHorse: 9,
        CityOfBirth: 10,
        Unspecified: 11,
        PaternalGrandfatherFirstName: 12,
        ChildhoodFriend: 13,
        HighschoolMascot: 14,
        FirstCar: 15
    };

    gec.PunterAddress = function (params) {

        var _instance = this;
        this.address1;
        this.address2;
        this.city;
        this.state;
        this.zip;
        var SEPARATOR = "\n";

        this.set = function (punterAddress) {
            var address = punterAddress.split(SEPARATOR);
            if (address != null) {
                if (address.length > 0)
                    _instance.address1 = address[0];

                if (address.length > 1)
                    _instance.address2 = address[1];

                if (address.length > 2)
                    _instance.city = address[2];

                if (address.length > 3)
                    _instance.state = address[3];

                if (address.length > 4)
                    _instance.zip = address[4];
            }
        }
        if (params != null)
            this.set(params);

        this.get = function () {
            return _instance.address1 + SEPARATOR + _instance.address2 + SEPARATOR + _instance.city + SEPARATOR + _instance.state + SEPARATOR + _instance.zip;
        }
    };
    gec.PunterName = function (params) {

        var _instance = this;
        this.firstName;
        this.middleName;
        this.lastName;

        var SEPARATOR = "\n";

        this.set = function (p) {
            var name = p.split(SEPARATOR);
            if (name != null) {
                if (name.length > 0)
                    _instance.firstName = name[0];

                if (name.length > 1)
                    _instance.middleName = name[1];

                if (name.length > 2)
                    _instance.lastName = name[2];

            }
        }
        this.set(params);

        this.toString = function () {
            return _instance.firstName + SEPARATOR + _instance.middleName + SEPARATOR + _instance.lastName;
        }
    };
    gec.MarketType = {
        Win: 1,
        Place: 2,
        MatchOdds: 3,
        OverUnder: 4,
        AsianHandicap: 10,
        TwoBall: 11,
        ThreeBall: 12,
        Unspecified: 13,
        MatchMarket: 14,
        SetMarket: 15,
        Moneyline: 16,
        Total: 17,
        Handicap: 18,
        EachWayNonHandicap: 19,
        EachWayHandicap: 20,
        EachWayTournament: 21,
        RunningBall: 22,
        MatchBetting: 23,
        MatchBettingInclDraw: 24,
        CorrectScore: 25,
        HalfTimeFullTime: 26,
        TotalGoals: 27,
        GoalsScored: 28,
        Corners: 29,
        OddsOrEvens: 30,
        HalfTimeResult: 31,
        HalfTimeScore: 32,
        MatchOddsExtraTime: 33,
        CorrectScoreExtraTime: 34,
        OverUnderExtraTime: 35,
        ToQualify: 36,
        DrawNoBet: 37,
        HalftimeAsianHcp: 39,
        HalftimeOverUnder: 40,
        NextGoal: 41,
        FirstGoalscorer: 42,
        LastGoalscorer: 43,
        PlayerToScore: 44,
        FirstHalfHandicap: 45,
        FirstHalfTotal: 46,
        SetBetting: 47,
        GroupBetting: 48,
        MatchplaySingle: 49,
        MatchplayFourball: 50,
        MatchplayFoursome: 51,
        TiedMatch: 52,
        TopBatsman: 53,
        InningsRuns: 54,
        TotalTries: 55,
        TotalPoints: 56,
        FrameBetting: 57,
        ToScoreFirst: 58,
        ToScoreLast: 59,
        FirstScoringPlay: 60
    };
    gec.OrderFillType = {
        Normal: 1,
        FillAndKill: 2,
        FillOrKill: 3,
        FillOrKillDontCancel: 4,
        SPIfUnmatched: 5
    };
    gec.MultipleBetStatus = {
        Active: 1,
        Voided: 2,
        SettledFor: 3,
        SettledAgainst: 4,
        SettledUnclaimed: 5,
        CashedOut: 6
    };
    gec.MultipleLegStatus = {
        Unknown: 1,
        Won: 2,
        Lost: 3,
        Voided: 4
    };
    gec.SelectionStatus = {
        Inactive: 1,
        Active: 2,
        Suspended: 3,
        Withdrawn: 4,
        Voided: 5,
        Completed: 6,
        ResultsSet: 7,
        Settled: 8,
        BallotedOut: 9
    };
    gec.SportsBetPriceType = {
        FixedPrice: 1,
        StartingPrice: 2,
        BestOddsGuaranteed: 3
    };
    gec.ChannelType = {
        Internet: 1,
        Mobile: 2,
        Telebetting: 3,
        API: 4,
        LightweightPrice: 5,
        Kiosk: 6,
        GBEIntegrationSolution: 7,
        GBEIntegrationSolutionTelebetting: 8
    };
    gec.GranularChannelType = {
        MobileBrowser: 1,
        TabletBrowser: 2,
        MobileApplication: 3,
        TabletApplication: 4,
        InternetBrowser: 5,
        InternetApplication: 6,
        LiveOperator: 7,
        SelfService: 8,
        API: 9
    };

    gec.WithdrawRepriceOption = {
        Reprice: 1,
        Cancel: 2,
        DontReprice: 3
    };

    gec.FundsTransferMethodType = {
        DebitCard: 1,
        CreditCard: 2,
        ChequeIn: 3,
        ChequeOut: 4,
        ElectronicFundsTransferIn: 5,
        ElectronicFundsTransferOut: 6,
        InternetPaymentProvider: 7,
        BankTransfer: 8,
        MCard: 9,
        OTC: 10,
        Agent: 11,
        WesternUnion: 12,
        Paysafe: 13,
        MoneyBookers: 14,
        Neteller: 15,
        ExternalSystem2: 16,
        ExternalSystem1: 17,
        OnCourseCash: 18,
        WebMoney: 19,
        ACH: 20
    };
    gec.PostingType = {
        Settlement: 1,
        Commission: 2,
        Transfer: 3,
        Lodgement: 4,
        Withdrawal: 5,
        TransferToSportsbook: 6,
        TransferFromSportsbook: 7,
        SinglePurseStakeTransfer: 8,
        SinglePursePosting: 9,
        DeviceStakeTransfer: 10,
        DevicePayoutPayment: 11,
        Tax: 12,
        GamePlay: 13,
        AdvancePayment: 14,
        Bonus: 15,
        Reward: 16,
        Stake: 17,
        Refund: 18,
        Adjustment: 19,
        ProductPurchase: 20,
        ProductRefund: 21
    };

    gec.FTMRStatus = {
        Enabled: 1,
        Blocked: 2,
        Removed: 3
    };
    gec.PurseIntegrationMode = {
        SinglePurse: 1,
        FundsTransfer: 2
    };

    gec.ContactType = {
        Unknown: 1,
        PressAdvertisment: 2,
        PressArticle: 3,
        SearchEngine: 4,
        OtherService: 5,
        ReferAFriendProgram: 6,
        TVOrRadio: 7,
        Promotion: 8
    };

    gec.BettingTypeId = {
        Undefined: null,
        Both: 1,
        ExchangeOnly: 2,
        SportsbookOnly: 3
    };

    gec.ReturnCode = {
        Success: 0,
        ResourceError: 1,
        SystemError: 2,
        EventClassifierDoesNotExist: 5,
        MarketNameAlreadyExists: 6,
        MarketDoesNotExist: 8,
        SelectionNameAlreadyExists: 9,
        SelectionDoesNotExist: 11,
        NewSelectionsProhibited: 12,
        SelectionNotSuspended: 13,
        MarketNotSuspended: 14,
        MarketNotActive: 15,
        MarketNeitherSuspendedNorActive: 16,
        SelectionNotActive: 17,
        InsufficientBrokerFunds: 18,
        InsufficientVirtualPunterFunds: 19,
        BrokerDoesNotExist: 20,
        OrderDoesNotExist: 21,
        NoUnmatchedAmount: 22,
        CurrencyNotValid: 23,
        VirtualPunterDoesNotExist: 24,
        PunterReservationPerMarketExceeded: 25,
        AccountDoesNotExist: 26,
        AccountBalanceNotZero: 27,
        AccountNotActive: 28,
        InsufficientFundsInAccount: 29,
        FundsReservationDoesNotExist: 30,
        BrokerNameAlreadyExists: 32,
        BrokerHasOrders: 33,
        BrokerAlreadyActive: 34,
        BrokerAlreadySuspended: 35,
        PaymentInstructionDoesNotExist: 36,
        CountryCodeDisallowed: 48,
        NegativeTradingLimit: 53,
        NegativeAbsoluteLimit: 54,
        IncompatibleCurrencies: 55,
        ParentDoesNotExist: 56,
        MarketAlreadySuspended: 57,
        SelectionAlreadySettled: 58,
        MarketCannotBeDeleted: 59,
        MarketDoesNotSupportInRunning: 60,
        MarketCannotBeTurnedInRunning: 61,
        SelectionAlreadySuspended: 62,
        UnknownEventSubscription: 63,
        CurrencyAccountAlreadyExists: 65,
        CurrencyNotSupported: 66,
        PunterReservationDoesNotExist: 67,
        RecursiveMove: 68,
        EventClassifieontainsUnsettledMarkets: 69,
        LanguageAlreadyExists: 70,
        LanguageDoesNotExist: 71,
        KeyPhraseAlreadyExists: 72,
        KeyPhraseDoesNotExist: 73,
        TranslationPhraseDoesNotExist: 74,
        MarketSelectionMismatch: 75,
        NoResultsPreviouslySpecified: 76,
        InvalidStateForVoiding: 77,
        MarketNotInactive: 78,
        MarketHasHadOrders: 79,
        MarketNotComplete: 80,
        UserNotAuthenticated: 81,
        UserNotAuthorisedForAPI: 82,
        UserNotAuthorisedForBroker: 83,
        UsernameAlreadyExists: 84,
        AuthorisedUserDoesNotExist: 85,
        APIDoesNotExist: 86,
        UserAlreadyAuthorisedForAPI: 87,
        UserAlreadyAuthorisedForBroker: 88,
        BrokeategoryNameAlreadyExists: 89,
        BrokeategoryDoesNotExist: 90,
        CommissionRuleDoesNotExist: 91,
        UserTypeNameAlreadyExists: 92,
        UserTypeDoesNotExist: 93,
        BrokerSuspended: 94,
        SelectionHasHadOrders: 95,
        SelectionNotInactive: 96,
        SelectionNotComplete: 97,
        SelectionNeitherSuspendedNorActive: 98,
        AccountHasHadPosting: 99,
        AccountNotSuspended: 100,
        DebitPostingsNotAllowedOnAccount: 101,
        BrokeurrencyAccountAlreadyExists: 102,
        SelectionNotSettled: 103,
        TaggedValueDoesNotExist: 104,
        CurrencyDoesNotExist: 105,
        CurrencyAlreadyActive: 106,
        CurrencyNotActive: 107,
        TransactionDoesNotExist: 108,
        AccountClosed: 109,
        ExchangeRateNotRelevant: 110,
        SelectionIsActive: 111,
        AccountAlreadyClosed: 112,
        ParameterFormatError: 113,
        ResetHasOccurred: 114,
        TranslationPhrasesExist: 115,
        BrokeategoryHasBrokers: 116,
        WithdrawalProhibitedOnMarket: 117,
        VirtualSelection: 118,
        KeyPhraseCategoryDoesNotExist: 119,
        KeyPhraseCategoryAlreadyExists: 120,
        AuthorisedApplicationNameAlreadyExists: 121,
        AuthorisedApplicationDoesNotExist: 122,
        UserAlreadyAuthorisedForApplication: 123,
        ApplicationNotAuthorisedForUser: 124,
        TargetAuthorisedUserDoesNotExist: 125,
        TargetUserNotAuthorisedForAPI: 126,
        OrderAlreadySuspended: 127,
        TradingCurrentlySuspended: 128,
        TradingNotSuspended: 129,
        NumberOfWinningSelectionsInvalid: 130,
        InvalidOdds: 131,
        TranslationPhraseAlreadyExists: 132,
        SelectionHasVirtualSelection: 133,
        ParameterMissingError: 134,
        AccountIsInternalCurrencyAccount: 135,
        WithdrawalSequenceNumberIsInvalid: 136,
        MaximumInputRecordsExceeded: 137,
        StartTimeNotSpecified: 138,
        BrokerOrderMismatch: 139,
        VirtualPunterOrderMismatch: 140,
        MarketHasNoSelections: 141,
        MarketAlreadyInrunning: 142,
        RequiredSystemAccountNotConfigured: 143,
        MarketSettlementInProgress: 144,
        EventClassifieontainsEventClassifiers: 145,
        EventClassifierIsBlocked: 146,
        EventClassifierIsNotBlocked: 147,
        PunterDoesNotExist: 201,
        NostroVostroAccountAlreadyExists: 203,
        FTMRDoesNotExist: 204,
        FTMRNotKnownToIssuer: 205,
        PaymentDeclinedByIssuer: 206,
        PaymentBridgeNotAvailable: 207,
        PunterSuspended: 208,
        PunterUsernameAlreadyExists: 211,
        PunterHasOrders: 213,
        PunterAlreadyActive: 214,
        PunterAlreadySuspended: 215,
        EventClassifierAlreadyExists: 218,
        MarketAlreadyExists: 219,
        SelectionAlreadyExists: 220,
        PunteategoryNameAlreadyExists: 221,
        PunteategoryDoesNotExist: 222,
        FundsReservationAlreadyExists: 223,
        PunterReservationAlreadyExists: 224,
        FundsTransferMethodNameAlreadyExists: 226,
        FundsTransferMethodDoesNotExist: 227,
        CountryDoesNotExist: 228,
        BINValueAlreadyExists: 229,
        BINDoesNotExist: 230,
        FTMRNumberAlreadyExists: 231,
        NicknameAlreadyExists: 232,
        ImpliedBINDoesNotExist: 233,
        InvalidFTMRNumber: 234,
        FTMRAlreadyBlocked: 235,
        FTMRAlreadyEnabled: 236,
        WithdrawalRequestDoesNotExist: 237,
        WithdrawalRequestNotPending: 238,
        PunterProhibitedFromPlacingOrders: 240,
        InsufficientPunterFunds: 241,
        MinimumBalanceWouldBeBreached: 242,
        WithdrawalToFundsTransferMethodProhibited: 243,
        PunterProhibitedFromDepositing: 244,
        DepositFromBINProhibited: 245,
        DepositFromFundsTransferMethodProhibited: 246,
        WithdrawalExceedsAmountDeposited: 247,
        MaximumPunterFTMRLimitReached: 248,
        WithdrawalLessThanDeposit: 249,
        PunterProhibitedFromWithdrawing: 250,
        WithdrawalToBINProhibited: 251,
        FTMRIsBlocked: 252,
        DepositWouldExceedFundsTransferMethodLimit: 253,
        DepositWouldExceedBINLimit: 254,
        DepositWouldExceedPunterLimit: 255,
        WithdrawalWouldExceedFundsTransferMethodLimit: 256,
        WithdrawalWouldExceedBINLimit: 257,
        WithdrawalWouldExceedPunterLimit: 258,
        AccountAlreadySpecifiedForFundsTransferMethod: 259,
        FTMRDetailsNotSpecified: 260,
        IncorrectFTMRDetailsSpecified: 261,
        AccountNotAssociatedWithFundsTransferMethod: 262,
        StoryDoesNotExist: 263,
        PaymentOutcomeUnknown: 264,
        PendingPaymentTransactionDoesNotExist: 265,
        FTMSpecificError: 266,
        InvalidUsername: 267,
        PaymentFailedRiskCheck: 268,
        NegativeDepositLimit: 269,
        NegativeWithdrawalLimit: 270,
        OrderAPIInProgress: 271,
        NegativeCurrentMinimumBalance: 272,
        PunterNotLocked: 273,
        PunterOrderMismatch: 274,
        ImpliedBINDoesNotExistForFTM: 275,
        UserAlreadyAuthorisedForPunter: 276,
        UserNotAuthorisedForPunter: 277,
        CreditCardNumberNotAvailable: 278,
        FundsTransferPaymentDoesNotExist: 279,
        MarketNotEnabledForMultiples: 281,
        MultipleBetDoesNotExist: 282,
        MatchedMultipleBetChunkDoesNotExist: 283,
        MultipleLayerDoesNotExist: 284,
        MultipleLayerParameterAlreadyExists: 285,
        MultipleLayerParameterDoesNotExist: 286,
        LevelsRequestedExceedsMaximum: 288,
        NoMultipleOfferAvailable: 289,
        PunterAlreadyRegisteredAsMultipleLayer: 290,
        MultipleLayeurrentlySuspended: 291,
        MultipleLayerNotSuspended: 292,
        InRunningDelayInEffect: 293,
        PunterHasNotPlacedBet: 294,
        MultipleSelectionsUnderSameEvent: 295,
        MultipleSelectionsWithSameName: 296,
        InvalidNumberOfSelections: 297,
        MultipleBetAlreadyVoided: 298,
        DuplicateOrderSpecified: 299,
        SelectionIsNotWithdrawn: 300,
        OrderNotSuspended: 301,
        PunterIsSuspendedFromTrading: 302,
        PunterHasActiveOrders: 303,
        PunterNotSuspendedFromTrading: 304,
        ExpiryTimeInThePast: 305,
        NoChangeSpecified: 306,
        SoapHeaderNotSupplied: 307,
        IncorrectVersionNumber: 308,
        NoUsernameSpecified: 309,
        InvalidParameters: 310,
        NoPasswordSpecified: 311,
        PunterRestrictedFromAgainstSideOrders: 314,
        PunterRestrictedFromForSideOrders: 315,
        PunterRestrictedToFillKillOrders: 316,
        PaymentConfirmationNotPending: 400,
        DuplicateAffiliateIdentifierSpecified: 401,
        AffiliateDoesNotExist: 402,
        PunterNoteDoesNotExist: 403,
        PunterNoteAlreadyDeleted: 404,
        InvalidPassword: 405,
        PunterIsBlacklisted: 406,
        PuntelassificationNameExists: 420,
        PuntelassificationDoesNotExist: 421,
        PrivateLiquidityPoolDoesNotExist: 422,
        AlreadyEnabledForPrivateLiquidityPool: 423,
        NotEnabledForPrivateLiquidityPool: 424,
        PunterNotRegisteredAsMultipleLayer: 425,
        UnacceptableIPAddress: 437,
        LocalBetDoesNotExist: 439,
        NotBrokersPrimaryCurrency: 446,
        MarketNotEnabledForEachWay: 450,
        EachWayResultsNotSpecified: 451,
        PlaceStakeExceedsWinStake: 452,
        MarketNotEnabledForPreferredMatching: 453,
        LocalBetNotPlaced: 454,
        IncompletePriceRangeSpecified: 455,
        EachWayNotAllowedWithVirtualSelections: 456,
        PunterIdentificationNotEnabled: 457,
        EachWayParametersNotSpecified: 458,
        EachWayOrdersHaveBeenPlaced: 459,
        EachWayIncompatibleWithMarketType: 460,
        ResetCountIsInvalid: 461,
        PunterAlreadyRegisteredForHeartbeat: 462,
        PunterNotRegisteredForHeartbeat: 463,
        ThresholdSpecifiedTooSmall: 473,
        PunterTaggedValueDoesNotExist: 475,
        UnmatchedOrdeouldResult: 477,
        GenericTaggedValueDoesNotExist: 478,
        CannotUnsetAtRoot: 480,
        SystemParameterDoesNotExist: 481,
        BrokerNotActive: 482,
        BrokerNotEnabledForExternalSystem: 483,
        NotRegisteredForExternalSystem: 484,
        UserAlreadyRegisteredForExternalSystem: 485,
        ExpiredTAndCVersion: 486,
        ExternalSystemNicknameUnknown: 487,
        ExternalSystemNicknameNotAvailable: 488,
        ExternalSystemUnavailable: 489,
        UserBlockedOnExternalSystem: 490,
        WithdrawalWouldExceedSystemLimit: 491,
        DepositWouldExceedSystemLimit: 492,
        PICPunterNotKnown: 493,
        PICPunterNotActive: 494,
        PICInsufficientFunds: 495,
        PICSystemError: 496,
        PICCurrencyNotValid: 497,
        PICUnavailable: 498,
        PICTransactionRefused: 499,
        PunterNotRegisteredToIntegrationPartner: 500,
        DuplicateReferenceNumbersExist: 501,
        IntegrationPartnerNameAlreadyExists: 503,
        IntegrationPartnerDoesNotExist: 504,
        TermsAndConditionsAlreadyExists: 505,
        TermsAndConditionsDoesNotExist: 506,
        PostingDoesNotExist: 507,
        PostingNotAwaitingApplication: 508,
        PICDeviceNotKnown: 509,
        PICDeviceDisabled: 510,
        PartnerTokenNotAuthenticated: 511,
        SessionTokenNotAuthenticated: 512,
        PunterIntegrationPartnerMismatch: 513,
        SessionTokenNoLongerValid: 514,
        IntegrationPartnerIsPartnerOperated: 515,
        IntegrationPartnerNotWhiteLabelDuplicateRegistration: 516,
        PunterNotFundsTransfer: 517,
        UsernameDoesNotExist: 518,
        MaximumOutputRecordsExceeded: 519,
        PICPunterNotAuthenticated: 520,
        PasswordAuthenticationNotAllowed: 521,
        PICPasswordTokenTooOld: 522,
        PICPasswordNotSpecified: 523,
        AnonymousOperationNotSupported: 524,
        IntegrationPartnerDidNotAuthenticate: 525,
        IntegrationPartnerAccountAlreadyExists: 526,
        AuthorisedUserNotFinanceUser: 530,
        DeprecatedAPIVersion: 531,
        PICPasswordOptionNotSpecified: 532,
        PunterNotAuthorisedForAPI: 533,
        PunterReservationNotAwaitingApplication: 534,
        SinglePurseNotSupported: 535,
        PunterReservationNotSupported: 536,
        ChangeOrdersNotSupported: 537,
        ClientDoesNotExist: 538,
        UserNotAuthorisedFolient: 539,
        NoSelectionPriceCurrentlySet: 542,
        ArbitraryInformationDoesNotExist: 543,
        UserAlreadyAuthorisedFolient: 544,
        FeedDoesNotExist: 545,
        UserNotAuthorisedForFeed: 546,
        UserAlreadyAuthorisedForFeed: 547,
        FeedItemDoesNotExist: 548,
        FeedItemAlreadyExists: 549,
        MappingInformationDoesNotExist: 550,
        MappingDoesNotExit: 551,
        MappingAlreadyExists: 552,
        ClientCapabilityDoesNotExist: 553,
        ClientCapabilityAlreadyExists: 554,
        IsLineBetting: 555,
        MarketTypeNotLineBetting: 556,
        MarketContainsUnsettledSelections: 557,
        NegativeMoneyAmountSpecified: 558,
        MultipleBetLayParametersAlreadyExists: 559,
        MultipleBetLayParametersDoesNotExist: 560,
        ClientAlreadyExists: 561,
        PoolDoesNotExist: 563,
        PoolNotAvailableForBetting: 564,
        SelectionsNotConsistentWithPool: 565,
        RunnerDoesNotExist: 566,
        ProviderNotAvailable: 567,
        PoolBetRejectedByProvider: 568,
        StakeNotConsistentWithPool: 569,
        RunnerUnavailableForBetting: 570,
        RaceNotAvailable: 571,
        PoolBetDoesNotExist: 572,
        PoolBetAlreadySettled: 573,
        TotalStakeIncorrect: 574,
        CannotDeleteAtRoot: 575,
        IncompleteTimeRangeSpecified: 576,
        RaceDoesNotExist: 577,
        EachWayLayBetsNotAllowed: 579,
        OrderSettledOrVoided: 581,
        LocalBetSettledOrVoided: 582,
        MultipleBetSpansBrokers: 583,
        PartnerTelebetTokenNotAuthenticated: 584,
        TelebetSessionTokenNotAuthenticated: 585,
        NotSessionless: 586,
        NotTelebetSession: 587,
        NotTelebetUserSession: 588,
        NotUserSession: 589,
        NeitherUserNorTelebetUserSession: 590,
        DefaultsNotLoaded: 591,
        OrdeacheNotPresent: 592,
        AgentTokenNotAuthenticated: 593,
        NoAgentSession: 594,
        AgentSessionAlreadyExists: 595,
        StakeOutsideAcceptableRange: 596,
        MarketIsForRealMoney: 597,
        MarketIsForPlayMoney: 598,
        MarketIsForPlay: 599,
        PunterHasPlayCurrency: 600,
        RingfencedLiquidityPoolMismatch: 601,
        MatchedOrderDoesNotExist: 602,
        UserNotAuthorisedForRingfencedLiquidityPool: 603,
        CantMoveBetweenRingfencedLiquidityPools: 604,
        EventClassifierAlreadyBlockedForBroker: 605,
        EventClassifierNotBlockedForBroker: 606,
        SelectionsInRingfencedLiquidityPool: 607,
        PunterInRingfencedLiquidityPool: 608,
        CantTransferBetweenPlayAndRealCurrencies: 609,
        RequestDidNotAuthenticate: 610,
        PoolBetNotUnknownStatus: 611,
        PunterNotAuthenticated: 612,
        IntegrationPartnerIsStandalone: 613,
        IntegrationPartnerIsNotStandalone: 614,
        APIIsDeprecated: 615,
        PunterHasRealCurrency: 616,
        CurrentlyUserSession: 617,
        EventCacheNotPresent: 618,
        MobileApplicationNotSupported: 638,
        InsufficientFreeBetStakeAvailable: 644,
        FreeBetEntitlementDoesNotExist: 645,
        FreeBetEntitlementNotActive: 646,
        ExchangeRateProviderDoesNotExist: 649,
        FXRateOverrideDoesNotExist: 650,
        FXRateOverrideNotActive: 651,
        AmountInPuntersCurrencyNotSpecified: 652,
        CannotChangeFreeBetEntitlementOrder: 653,
        IntegrationPartnerIsActive: 654,
        IntegrationPartnerNotActive: 655,
        UnmatchableAmount: 656,
        EventClassifierIsNotEmpty: 657,
        AAPIDoesNotExist: 658,
        AAPIPunterGroupDoesNotExist: 659,
        AUSVDoesNotExist: 660,
        AAPIPunterGroupNameAlreadyExists: 661,
        NoApplicableCustomHierahy: 662,
        ConcurrentSessionLimitReached: 671,
        ConnectionInInvalidState: 672,
        PunterNotAuthorisedForAAPI: 673,
        SubscriptionDoesNotExist: 674,
        PunterIsBanned: 675,
        AAPIPunterGroupNotEmpty: 676,
        PunteategoryIsNotEmpty: 677,
        PoolBetAlreadyExists: 678,
        PoolBetWasPlacedDirectly: 679,
        PunterFailedIdentityVerificationCheck: 680,
        IntegrationPartnerNotExternalPurseProvider: 681,
        IntegrationPartnerIsNormal: 682,
        IntegrationPartnerNotNormal: 683,
        IntegrationPartnerIsExternalGame: 684,
        IntegrationPartnerNotExternalGame: 685,
        CardDoesNotExist: 686,
        PoolBetWasNotPlacedDirectly: 687,
        TicketSerialNumberNotUnique: 688,
        RewardRuleDoesNotExist: 689,
        NoSession: 690,
        PSIDoesNotExist: 691,
        PSINameAlreadyExists: 692,
        PunterAlreadyAssignedToPSI: 693,
        PunterNotAssignedToPSI: 694,
        PSIRestrictedToDifferentIntegrationPartner: 695,
        NotPossibleToRestrictPSIToIntegrationPartner: 696,
        PSIIsDefaultOrPunterSpecific: 697,
        PartnerUsernameSpecified: 698,
        PunterIdSpecified: 699,
        PuntehangeSequenceNumberDoesNotExist: 700,
        AAPINotSupported: 701,
        EnrolmentAttemptDoesNotExist: 702,
        EnrolmentAttemptNotAuthenticated: 703,
        PoolBetCancellationRejectedByRule: 704,
        PoolBetCancellationRejectedByProvider: 705,
        PoolBetNeitherActiveNorSettledVoid: 706,
        VideoProviderNotCurrentlyAvailable: 707,
        RaceVideoDoesNotExist: 708,
        CardVideoDoesNotExist: 709,
        FundsTransferMethodNotSupported: 710,
        FTMRNotPreviouslyUsedForDeposit: 711,
        TransactionNumberLimitExceeded: 712,
        TransactionAmountLimitExceeded: 713,
        OpenTransactionLimitExceeded: 714,
        SingleTransactionAmountExceeded: 715,
        FTMRuleAlreadyExists: 716,
        FTMRuleDoesNotExist: 717,
        PostingNotUnsuccessfullyApplied: 718,
        MultipleTransactionsAwaitingCompletion: 719,
        FTMPunterLimitReached: 720,
        PaymentDoesNotExist: 801,
        FTMNotSpecified: 802,
        FTMNotEnabledForPuntehannel: 803,
        RaceMeetingDoesNotExist: 804,
        CardIsMapped: 805,
        CardNotMapped: 806,
        CardRaceNumberDoesNotExist: 807,
        CardRaceNumberIsMapped: 808,
        CardRaceNumberNotMapped: 809,
        NotAllCardRaceReferencesMapped: 810,
        ExternalSystemDoesNotExist: 811,
        PICSelectionDoesNotExist: 812,
        PICMarketNotActive: 813,
        PICSelectionNotActive: 814,
        PICInvalidPrice: 815,
        PICInrunningDelayStillInEffect: 818,
        CustomMarketListHandlerNotKnown: 819,
        CustomMarketListHandlerSpecificError: 820,
        ValueIsNotEncrypted: 821,
        ConnectionNotDropped: 822,
        PunteashOutRequirementsNotMet: 823,
        DesiredClosingPositionNotPossible: 824,
        OrdersSpecifiedNotClosingPosition: 825,
        OrdersSpecifiedNotMatched: 826,
        PunterHasActiveOrdersOnMarket: 827,
        PICPriceChanged: 828,
        PICBetRejected: 829,
        CustomServiceHandlerNotKnown: 830,
        CustomServiceHandlerSpecificError: 831,
        IncompatibleVisibilities: 832,
        SPBettingIsNotSupported: 833,
        EMailAddressAlreadyUsed: 834,
        ContentItemDoesNotExist: 835,
        InstantFundingNotSupported: 836,
        LodgementCannotBeCancelled: 837,
        PunterLodgementMismatch: 838,
        CashCardAccountAlreadyRegistered: 839,
        ActionNotAppropriateAtThisTime: 840,
        PartnerAccountIsBusy: 841,
        PunterDeleted: 842,
        PunterNotSuspended: 843,
        PunterNotActive: 844,
        SettingTaggedValueNotAllowed: 845,
        DeletingTaggedValueNotAllowed: 846,
        FTMRPunterMismatch: 847,
        PunterRegistrationNotCompleted: 848,
        ExternalSystemTimedOut: 849,
        ProhibitedBySpecialRule: 850,
        PINNotAuthenticated: 851,
        PunterNotEnrolled: 854,
        AccountHasUnsettledTransactions: 855,
        DuplicateAttempt: 856,
        AccountHasHadActivity: 857,
        AccountAssociatedWithOtherPunter: 858,
        CommissionAmountSpecifiedIsIncorrect: 859,
        StoreProductDoesNotExist: 860,
        StoreSubscriptionDoesNotExist: 861,
        StoreProductNotCurrent: 862,
        StoreSubscriptionNotCurrent: 863,
        MaxOnlineEnrollmentAttemptsExceeded: 864,
        StoreProductAlreadyGranted: 865,
        StoreSubscriptionAlreadyGranted: 866,
        SubscriptionDoesNotCoverProduct: 867,
        SubscriptionInvalidPeriod: 868,
        StoreProductNotCurrentlyAvailable: 869,
        MaxStoreProductsReached: 870,
        StoreProductNotGranted: 871,
        StoreSubscriptionNotGranted: 872,
        FollowRequestAlreadyExists: 873,
        FollowRequestDoesNotExist: 874,
        PunterAddedNoteAlreadExists: 875,
        PunterAddedNoteDoesNotExist: 876,
        AddedPunterNotePunterMismatch: 877,
        FollowRequestPunterMismatch: 878,
        LimitExceedsMaximum: 879,
        CohortDoesNotExist: 880,
        UnableToChangeCohortCurrently: 881,
        InsufficientLoyaltyPointsBalance: 882,
        RuleAlreadyExists: 883,
        RuleDoesNotExist: 884,
        SPOrdersNotSupportedOnMarket: 885,
        ProhibitedFromPlacingSPOrders: 887,
        NegativeAmountSpecified: 888,
        CantUndoSPMatching: 889,
        CantRedoSPMatching: 890,
        InvalidConfiguration: 891,
        CannotChangeToSPIfUnmatched: 892,
        IncompatibleSessionCategory: 893,
        NoOrdersToCancel: 894,
        FundsTransferPaymentCannotBeUpdated: 895,
        PunterAlreadyInCohortSpecified: 896,
        ConcurrentExecutionNotAllowed: 897,
        PunterOnOldPointsRegime: 898,
        RuleConfigurationInconsistent: 899,
        LocationNotSpecified: 900,
        LocationNotAccurateEnough: 901,
        LocationNotAcceptable: 902,
        ContestDoesNotExist: 903,
        ContestNotOpen: 904,
        ContestFull: 905,
        PlayerEnteredMaximumTimes: 906,
        EntryCriteriaNotSatisfied: 907,
        EntryCodeNotSpecified: 908,
        EntryCodeNotAcceptable: 909,
        EntryDoesNotExist: 910,
        StakeTooSmall: 911,
        StakeTooBig: 912,
        ExposureTooSmall: 913,
        ExposureTooBig: 914,
        PriceTooHigh: 915,
        PriceTooLow: 916,
        FillTypeNotAllowed: 917,
        BackNotAllowed: 918,
        LayNotAllowed: 919,
        InRunningNotAllowed: 920,
        PrestartNotAllowed: 921,
        TimeTooEarly: 922,
        TimeTooLate: 923,
        MaximumOrdersPerMarketExceeded: 924,
        MaximumOrdersPerSelectionExceeded: 925,
        MarketNotAllowed: 926,
        MaximumMarketsReached: 927,
        MarketTypeNotAllowed: 928,
        ContestTemplateDoesNotExist: 929,
        ContestTemplateNotOpen: 930,
        PlayerProfileDoesNotExist: 931,
        ScreennameAlreadyExists: 932,
        PlayerProfileAlreadyExists: 933,
        ContestNameNotUnique: 934,
        PoweriteriaNotSatisfied: 935,
        PowerAIInvalid: 936,
        PowerAINotAllowed: 937,
        PowerObtainedMaximumActiveTimes: 938,
        PowerObtainedMaximumTotalTimes: 939,
        PowerObtainedMaximumTimesInContest: 940,
        PowerDefinitionDoesNotExist: 941,
        PowerDefinitionNotActive: 942,
        PowerNotAllowedInContest: 943,
        PowerIsContestSpecific: 944,
        PowerDoesNotExist: 945,
        PoweonditionNotSatisfied: 946,
        PowerNotActive: 947,
        NotAllSelectionsOnSameMarket: 948,
        JWTNotAuthenticated: 949,
        PunterLockedExcessiveAttempts: 950,
        NotSubpunterOfPunterSpecified: 951,
        NotAllowedToSwitch: 952,
        LoginCurrentlyProhibited: 953,
        LoginWithEmailAddressProhibited: 954,
        OnePunterMustRepresentExternalGame: 955,
        ContestEntrantsNotAllowed: 956,
        PunterNotContestEntrant: 957,
        reCAPTCHATokenRequired: 958,
        reCAPTCHATokenNotValid: 959,
        CantReversePosting: 960,
        MaximumSubscribedMarketsReached: 961,
        TrustedDevicesNotEnabled: 962,
        TwoFactorAuthenticationNotEnabled: 963,
        TrustedDevicesAlreadyEnabled: 964,
        TwoFactorTokenNotAuthenticated: 965,
        TwoFactorAuthenticationNotPending: 966,
        TrustedDeviceAlreadyExists: 967,
        TrustedDeviceDoesNotExist: 968,
        TwoFactorAuthenticationAlreadyEnabled: 969,
        TwoFactorAuthenticationRequired: 970,
        PunterNotAuthorisedForHostGame: 971,
        LossLimitWouldBeExceeded: 972,
        HostGameDoesNotExist: 973,
        NoCurrentContestForPunter: 974,
        PunterSelfExcluded: 975,
        MultipleBetCashOutRiskSchemeNotFound: 976,
        PunterMultipleBetMismatch: 977,
        PunterAccaGroupMismatch: 978,
        AccaGroupDoesNotExist: 979,
        MultipleBetCashOutOfferNotAvailable: 980,
        MinimumCashOutStakeBreached: 981,
        IdentityXTokenNotAuthenticated: 982,
        LocalBetCashOutRiskSchemeNotFound: 983,
        PunterLocalBetMismatch: 984,
        LocalBetCashOutOfferNotAvailable: 985,
        BetTypeNotAllowed: 986,
        InvalidPoolCombinations: 987,
        SSNNotUnique: 988,
        PunterHasFullSSN: 989,
        SSNFormatUnacceptable: 990,
        BetNotAllowedForPunter: 991,
        PoolBetIsNotParlay: 992,
        RiskGroupNameAlreadyExists: 993,
        LiabilityPoolDoesNotExist: 994,
        FunctionsAllowedDoesNotExist: 995,
        PriceMarginsDoesNotExist: 996,
        MaxLiabilitiesDoesNotExist: 997,
        RiskGroupProfileNameAlreadyExists: 998,
        RiskGroupProfileDoesNotExist: 999,
        MaxLiabilitiesNameAlreadyExists: 1000,
        RiskGroupDoesNotExist: 1001,
        InvalidClubName: 1002,
        ClubNameAlreadyExists: 1003,
        ClubDoesNotExist: 1004,
        SequenceNumberAlreadyExists: 1005,
        PunterNotRacingExtensionPunter: 1006,
        PCJWTDidNotAuthenticate: 1007,
        PuntClubAlreadyExists: 1008,
        PuntClubNameNotValid: 1009,
        PunterNotOptedInToPuntClub: 1010,
        PuntClubDoesNotExist: 1011,
        OrdersNotSupportedOnMarket: 1012,
        PostingNotNonWithddrawable: 1013,
        ClientIdAlreadyExists: 1014,
        ScopeNameNotUnique: 1015,
        OAuthClientDoesNotExist: 1016,
        OAuthClientSuspended: 1017,
        OAuthClientNotSuspended: 1018,
        ScopeNameDoesNotExist: 1019,
        OAuthAuthorizationCodeNotValid: 1020,
        OAuthRefreshTokenNotValid: 1021,
        PunterTokenMismatch: 1022,
        OAuthAuthorizationCodeDoesNotExist: 1023,
        OAuthRefreshTokenDoesNotExist: 1024,
        RaceDefinitionFormatError: 1025,
        ContestPunterNotRelated: 1026,
        ContestPuntersNotAllowed: 1027,
        NotEnteredInContest: 1028,
        ContestWithdrawalNotAllowed: 1029,
        ContestHasStarted: 1030,
        EntryAlreadyDisqualified: 1031,
        ContestAlreadyFinalised: 1032,
        EndtimeIsInFuture: 1033,
        EntryNotDisqualified: 1034,
        MaxEntriesWouldBeExceeded: 1035,
        MaxEntriesPerPunterWouldBeExceeded: 1036,
        StateNotAcceptable: 1037,
        ContestRegistrationNotOpen: 1038,
        PunterHasPartialSSN: 1039,
        ContestHasUnsettledPoolBets: 1040,
        ContestEntryHasPoolBets: 1041,
        MaxFailedAttemptsReached: 1042,
        AdditionalActionRequired: 1043,
        ResourceIsBusy: 1044,
        CounterOfferNotValid: 1045,
        CounterOfferExpired: 1046,
        RiskReferralDoesNotExist: 1047,
        ExclusionSourceDoesNotExist: 1048,
        InvalidExclusionStatus: 1049,
        DepositWouldExceedAffordabilityLimit: 1050,
        AffordabilityLimitNotEnabled: 1052,
        PromoCodeAlreadyExists: 1053,
        PromotionDoesNotExist: 1054,
        PromoCodeNotValid: 1055,
        PromotionHasAwards: 1056,
        PromotionIsAbandoned: 1057,
        PromotionInInvalidState: 1058,
        PromotionIsExpired: 1059,
        PunterNotEligibleForPromotion: 1060,
        PunterAlreadyOptedIntoPromotion: 1061,
        UnsupportedPromotionCurrency: 1062,
        ExceedsMaximumNumberOfParticipants: 1063,
        ExceedsMaximumAwardsPerPunter: 1064,
        ExceedsMaximumCreditAmountPerPunter: 1065,
        PunterHasNotOptedIntoPromotion: 1066,
        PromoCodeRequired: 1067,
        PromotionAwardDoesNotExist: 1068,
        PromotionAwardIsReversal: 1069,
        PromotionCreditAmountNotSpecified: 1070,
        DuplicateInputParameter: 1071,
        EnrolmentAttemptExpired: 1072,
        PICMaxRetriesExceeded: 1073,
        ProhibitedFromQuotingSBMultiples: 1074,
        ProhibitedFromPlacingSBMultiples: 1075,
        ProhibitedFromCashOutSBMultiples: 1076,
        SBMultiplesCombinationCountMismatch: 1077,
        SBMultiplesOfferedPriceMismatch: 1078,
        AmbiguousRiskReferralServices: 1079,
        SBMultiplesRejectedByRiskReferral: 1080,
        SBMultiplesReofferedByRiskReferral: 1081,
        SBMultipleBetDoesNotExist: 1082,
        SBMultipleBetAlreadyVoided: 1083,
        SBMultipleBetNotActive: 1084,
        PICPartnerAccountAlreadyExists: 1085,
        MaxOrderThrehsoldExceeded: 1086,
        PunterFailedUniquenessCheck: 1087,
        InvalidStatus: 1089,
        DepositWouldExceedPeriodLimit: 1090,
        DepositWouldExceedSelfImposedVelocityLimits: 1091,
        MonthlyNetLossLimitsNotEnabled: 1092,
        DepositWouldExceedMonthlyNetLossLimit: 1093,
        QueueingNotEnabled: 1094,
        QueueTokenNotSpecified: 1095,
        InvalidQueueToken: 1096,
        QueueTokenNotYetValid: 1097,
        QueueFull: 1098,
        InvalidQueueToken: 1099,
        InitializationInProgress: 1100,
        WalletNotAvailable: 1101,
        AccountAdjustmentsBlockedOnExternalSystem: 1102,
        PromotionAwardCriteriaNotMet: 1103,
        LocalBetAlreadyVoided: 1104,
	    MatchingWaitTimeExceeded: 1105,
        CancelWouldExceedPeriodLimit: 1106,
        PoolBetCancellationSuspended: 1107
    };

    gec.SubscribedObjectBase = function (obj) {
        const instance = this;
        var _delegates = {};
        var _firedDelegates = [];
        var _interest = 0;
        var delegateId = 0;

        this.interest = function (val) {
            _interest = _interest + val;
            return _interest;
        }

        this.fireDelegates = function (delegates, webMessage, deltaObject) {

            if (webMessage.isInitialTopicLoad()) {
                instance.fireILDelegates(delegates);
                return;
            }

            if (webMessage.isDeleteTopic()) {
                instance.fireDeltaDelegates("DELETED");
                return;
            }

            if (!webMessage.isInitialTopicLoad()) {
                instance.fireDeltaDelegates(deltaObject);
                return;
            }


        }

        this.fireILDelegates = function (delegates, changes) {
            if (!instance._isInitiallyLoaded()) return;
            for (s in delegates) {
                if (_firedDelegates[s] === undefined) {//only fire if not already fired for this object
                    _firedDelegates[s] = s;
                    delegates[s].call(this, obj, changes);
                }
            }
        }

        //methods
        this.resetFiredDelegates = function (delegate) {
            _firedDelegates = [];
            _delegates = {};
        };
        this.addDelegate = function (delegate) {
            _delegates[++delegateId] = delegate;
            return delegateId;
        };
        this.removeDelegate = function (delegateIndex) {
            delete _delegates[delegateIndex];
        };

        this.updateObject = function (changes) {
            var deltaObject = {};
            //do changes here
            for (var deli in _delegates) {
                _delegates[deli].call(null, this, deltaObject);
            }
        }

        this.fireDeltaDelegates = function (deltaObject) {
            for (var deli in _delegates) {
                _delegates[deli].call(null, obj, deltaObject);
            }
        }
        this.getDelegateCount = function () {
            var count = 0;
            for (var deli in _delegates) {
                count++;
            }
            return count;
        }
    };
    return gec;
}(gec || {}));

module.exports = gec