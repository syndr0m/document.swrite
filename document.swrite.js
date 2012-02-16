/*!
 * document.swrite : buffering of document.write()
 * ( https://github.com/syndr0m/document.swrite )
 * Copyright(c) 2012 Marc Dassonneville <marc.dassonneville@gmail.com>
 * MIT Licensed
 */

/**
 * Output Buffering of document.write()
 * @depends jquery 1.6+
 * 
 * Exemple :
 *  document.swrite('<div id="foo"></div>', function (html) {
 *     console.log(html) // => <div id="foo"></div>
 *  });
 * 
 *  document.swrite('<script>document.write("bar")</script>', function (html) {
 *     console.log(html) // => bar
 *  });
 *
 *  var html = '<script>document.write("<div ")</script>'
 *           + '<script>document.write("class=\"foo\">bar</div>"</script>';
 *  document.swrite(html, function (html) {
 *     console.log(html) // => <div class="foo">bar</div>
 *  });
 * 
 * How does it work :
 * 
 * <html>
 *   | html is processed to find group of consecutive scripts
 *   | a "position" is assigned to each group.
 * <script position="0"> -+
 * <script position="0">  |--- @position0 : buffering every document.write to position 0
 * <script position="0"> -+                 into htmlPosition0
 * <script position="1"> ----- @position1 : buffering every document.write to position 1
 *   |                                      into htmlPosition1
 *   | (for each "position", buffering every document.write launched by scripts
 *   |    by overwriting document.write )
 *   |
 *   | inserting htmlPositionX inside HTML at position X.
 *   |
 * <html + htmlPosition0 + htmlPosition1>
 *   |
 *   o returning full HTML.
 * 
 * Limitations :
 *  - only works with valid html on single level of consecutive scripts
 *  This will not work :
 *     var html = '<div><script>document.write("<span>")</script></span></div>'
 *     document.swrite(html, function (html) {
 *        console.log(html) // => (empty)
 *     });
 * 
 *  - will not work with "ASYNC" document.write :
 *     - will not work with scripts "setTimeouting" document.write()
 *     - will not work with scripts including ASYNC scripts calling document.write()
 *   (normally, you shouldn't be in this case, because ASYNC document.write
 *    means async document.open => clearing your document content)
 * 
 * Implementation is tricky because of ASYNC $.getScript()
 * 
 * @dependency jquery
 * @param  string html
 * @param  function callback(html) resulting html.
 * @return void
 */
document.swrite = (function () {

   
   /**
    * Positions are linked to contiguous scripts
    * 
    * Exemple :
    * > var html = `
    * <div id="foo">
    *    <script type="text/javascript">(...)</script>
    *    <script type="text/javascript" src="(...)"></script>
    *    <script type="text/javascript">(...)</script>
    * </div>
    * <script type="text/javascript">(...)</script>`
    * 
    * >
    * // will be converted to 
    * <div id="foo">
    *    <script type="text/javascript" position="0">(...)</script>
    *    <script type="text/javascript" src="(...)" position="0"></script>
    *    <script type="text/javascript"position="0">(...)</script>
    * </div>
    * <script type="text/javascript" position="1">(...)</script>
    * 
    * @param object jquery
    * @return object jquery
    */
   var computePositions = (function () {
      var uniqueId = 0;
      return function ($html)
      {
         $("script", $html).each(function () {
            var $script = $(this)
              , position = $script.prev("script").attr("position");
            if (typeof position == "undefined")
               position = uniqueId++
            $script.attr("position", position)
         });
         return $html  
      }
   })();
   
   /**
    * @param object HTMLScriptElement
    * @param function callback
    */
   var loadScript = function (script, callback)
   {
      if ($(script).attr("src"))
      {
         // ASYNC
         // ex: <script src="(cross domain)"></script>
         $.ajax({
            url: $(script).attr("src"),
            dataType: "script",
            success: callback,
            failure : callback
         })
      }
      else
      {
         // SYNC
         // ex: <script>alert('foo');</script>
         try {
         $.globalEval($(script).html());
         } catch (e) { }
         callback();
      }
   }
   
   /**
    * @param array[HTMLScriptElement, HTMLScriptElement, ...] scripts
    * @param function callback(positionHtml)
    */
   var loadScriptsRec = function (scripts, callback)
   {
      // terminaison : no more script to harvest
      if (scripts.length === 0) {
         callback()
         return
      }
      
      // harvest a single script
      loadScript(scripts[0], function () {
         scripts.shift();
         loadScriptsRec(scripts, callback);
      });
   };
   
   /**
    * harvest
    * 
    */
   var harvestPosition = function ($html, position, callback)
   {
      var scripts = $('script[position="'+position+'"]', $html)
         , dw = document.write; // backup
      
      // 
      var positionHtml = ''; // html document.writed by scripts at position
      document.write = function (html) {
         positionHtml += html
      };
      
      loadScriptsRec($.makeArray(scripts), function () {
         // restore
         document.write = dw;
         //
         callback(positionHtml);
      });
   };
   
   /**
    * recursive function
    * 
    * @param object jquery $html containing positions
    * @param callback($html) object jquery
    */
   var harvestPositionsRec = function ($html, callback)
   {
      var positions = $("script[position]", $html)
         .map(function () { return $(this).attr("position") })
      
      // terminaison : no more positions to harvest.
      if (positions.length === 0) {
         callback($html);
         return
      }
      
      // harvest scripts at position
      var position = positions[0];
      harvestPosition($html, position, function (positionHtml) {
         // going throw all the algorithm again. (deepth++)
         swrite(positionHtml, function (positionHtml) {
            $('script[position="'+position+'"]', $html).first().before(positionHtml)
            
            // remove all position scripts
            // FIXME: should remove all attributes,
            //  but any append(), or call() with jquery might
            //  exec the scripts again.
            $('script[position="'+position+'"]', $html).each(function () {
               $(this).remove();
            })

            // Recursive call
            harvestPositionsRec($html, callback);
         });
      });
   };
   
   /**
    * @param  string [valid html !]
    * @param  function callback(html) resulting html string
    * @return void
    */
   var swrite = function (html, callback)
   {
      var node = document.createElement("div");
      node.innerHTML = html;
      var $html = $(node)
        , $html = computePositions($html)

      // position => [script, script, script]
      harvestPositionsRec($html, function ($htmldebug) {
         callback($htmldebug.html());
      });
   };
   
   /**
    * one call to document.swrite at a time.
    * when a call is finished, next()
    */
   return (function semaphore() {
      var calls = []
      return function (html, callback) {
         // semaphore
         calls.push(arguments)
         if (calls.length > 1)
            return

         // swrite
         swrite(html, function (html) {
            callback(html);
            // next document.swrite()
            calls.pop();
            if (calls.length) {
               swrite.apply(this, calls[0])
            }
         });
      }
   })()
})()