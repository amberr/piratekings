function setup() {
    var element = document.getElementById('test-circle');
    var hammertime = Hammer(element).on("drag", function(event) {
    	// var xPosition = 
        element.style.top = event.gesture.center.pageY + "px";
        element.style.left = event.gesture.center.pageX + "px";
    });
}