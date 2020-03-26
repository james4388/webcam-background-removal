
# webcam-background-removal

Mimic Zoom webcam background feature run on browser

[DEMO](https://bgremoval.nhutrinh.com/)
  

1. Read image from webcam

2. Run `bodyPix.segmentPerson` to get estimate person segments

3. Turn segments into mask `bodyPix.toMask`

4. Clip webcam image with mask using offscreenCanvas

5. Draw background image

6. Draw offCanvas on top of background

7. Done

  

No compile needed, from the folder, run:

```

# python 3

python -m http.server

# python 2

python -m SimpleHTTPServer

```

  

then access

```

http://localhost:8000

```