# document.swrite : buffering of document.write()

Try it on [http://syndr0m.com:8080/statics/document.swrite.tests.html](http://syndr0m.com:8080/statics/document.swrite.tests.html).

## Goal

When a script execute document.write() after document.close() (when the page is loaded),
document.write() will call document.open() and clear your page content.

document.swrite is provided to buffer calls to document.write() inside your scripts.

## Examples

``` js
  document.swrite('<div id="foo"></div>', function (html) {
     console.log(html) // => <div id="foo"></div>
  });
```

``` js
  document.swrite('<script>document.write("bar")</script>', function (html) {
     console.log(html) // => bar
  });
```

``` js
  var html = '<script>document.write("<div ")</script>'
           + '<script>document.write("class=\"foo\">bar</div>"</script>';
  document.swrite(html, function (html) {
     console.log(html) // => <div class="foo">bar</div>
  });
```

## How does it work
 
``` text
 <html>
   | html is processed to find group of consecutive scripts
   | a "position" is assigned to each group.
 <script position="0"> -+
 <script position="0">  |--- @position0 : buffering every document.write to position 0
 <script position="0"> -+                 into htmlPosition0
 <script position="1"> ----- @position1 : buffering every document.write to position 1
   |                                      into htmlPosition1
   | (for each "position", buffering every document.write launched by scripts
   |    by overwriting document.write )
   |
   | inserting htmlPositionX inside HTML at position X.
   |
 <html + htmlPosition0 + htmlPosition1>
   |
   o returning full HTML.
```
 
## Limitations

  - only works with valid html on single level of consecutive scripts
  This will not work :

``` js
     var html = '<div><script>document.write("<span>")</script></span></div>'
     document.swrite(html, function (html) {
        console.log(html) // => (empty)
     });
```
 
  - will not work with "ASYNC" document.write :
     - will not work with scripts "setTimeouting" document.write()
     - will not work with scripts including ASYNC scripts calling document.write()
   (normally, you shouldn't be in this case, because ASYNC document.write
    means async document.open => clearing your document content)

## License

(The MIT License)

Copyright (c) 2012 by &lt;marc.dassonneville@gmail.com&gt;

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
