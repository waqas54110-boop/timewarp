export const SRGBColorSpace = 'srgb', DoubleSide = 2;
export class Vector3 { constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;} set(x,y,z){this.x=x;this.y=y;this.z=z;return this;} copy(v){this.x=v.x;this.y=v.y;this.z=v.z;return this;} }
export class Color { constructor(r=1,g=1,b=1){ if (typeof r==='number'&&g===1&&b===1&&arguments.length===1){this.r=this.g=this.b=1;} else {this.r=r;this.g=g;this.b=b;} } copy(c){this.r=c.r;this.g=c.g;this.b=c.b;return this;} lerp(c,a){this.r+=(c.r-this.r)*a;this.g+=(c.g-this.g)*a;this.b+=(c.b-this.b)*a;return this;} multiplyScalar(k){this.r*=k;this.g*=k;this.b*=k;return this;} }
export class Object3D { constructor(){this.children=[];this.parent=null;this.position=new Vector3();this.rotation={x:0,y:0,z:0,order:'XYZ',set(x,y,z){this.x=x;this.y=y;this.z=z;},copy(r){this.x=r.x;this.y=r.y;this.z=r.z;}};this.scale=new Vector3(1,1,1);this.visible=true;this.userData={};}
  add(...o){o.forEach(x=>{x.parent=this;this.children.push(x);});return this;} remove(x){const i=this.children.indexOf(x);if(i>=0)this.children.splice(i,1);} }
export class Group extends Object3D {}
export class Mesh extends Object3D { constructor(g,m){super();this.geometry=g;this.material=m;} }
class Attr { constructor(n){this.a=new Float32Array(n*3);this.count=n;this.needsUpdate=false;} setXYZ(i,x,y,z){this.a[i*3]=x;this.a[i*3+1]=y;this.a[i*3+2]=z;} getX(i){return this.a[i*3];} }
export class BufferGeometry { constructor(){this.attributes={};} translate(){return this;} dispose(){} }
export class PlaneGeometry extends BufferGeometry { constructor(){super();this.attributes.uv=new Attr(4);} }
export class CircleGeometry extends BufferGeometry {}
export class MeshBasicMaterial { constructor(o={}){Object.assign(this,o);this.color=new Color();} }
export class TextureLoader { load(url,cb){ setTimeout(()=>cb({image:{width:url.includes('v-')?800:1920,height:url.includes('v-')?400:960}}),0); } }
