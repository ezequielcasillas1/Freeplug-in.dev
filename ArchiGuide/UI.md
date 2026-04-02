Background Property
background: radial-gradient(circle, #660000 0%, #ffffff 0%, #ba3d3d 99%);
CSS Class
.gradient {
  background: radial-gradient(circle, #660000 0%, #ffffff 0%, #ba3d3d 99%);
}
Inline Style
style="background: radial-gradient(circle, #660000 0%, #ffffff 0%, #ba3d3d 99%);"
With Fallback Color
background-color: #660000;
background: radial-gradient(circle, #660000 0%, #ffffff 0%, #ba3d3d 99%);
Browser Prefixed (Legacy Support)
background: -webkit-radial-gradient(circle, #660000 0%, #ffffff 0%, #ba3d3d 99%);
background: -moz-radial-gradient(circle, #660000 0%, #ffffff 0%, #ba3d3d 99%);
background: radial-gradient(circle, #660000 0%, #ffffff 0%, #ba3d3d 99%);
SCSS Variable
$gradient: radial-gradient(circle, #660000 0%, #ffffff 0%, #ba3d3d 99%);

.element {
  background: $gradient;
}
CSS Custom Properties
:root {
  --gradient-angle: 47deg;
  --gradient-stops: #660000 0%, #ffffff 0%, #ba3d3d 99%;
}

.element {
  background: radial-gradient(var(--gradient-angle), var(--gradient-stops));
}
Tailwind CSS (Arbitrary Value)
bg-[radial-gradient(circle, #660000 0%, #ffffff 0%, #ba3d3d 99%)]

replace #660000 with #ba3d3d