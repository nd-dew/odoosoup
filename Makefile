extension.zip:	e.js manifest.json i.png odoosoup.css
	7z -mx=9 a $@ $^

clean:
	rm -f extension.zip
