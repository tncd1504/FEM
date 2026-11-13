*loop elems
*if(elemsmat==0)
*messagebox - An element without any material was found, some posibilities are that you forget to asign a material to the problem or there is a repited entity over another - Process finished with error
*endif
*end
*loop nodes
*if(NodesCoord(3)==0)
*else
*messagebox - This is a beams problem so z coordinate must be =0 for all nodes - Process finished with error
*endif
*if(NodesCoord(2)==0)
*else
*messagebox - This is a beams problem so y coordinate must be =0 for all nodes - Process finished with error
*endif
*end
*set var MATERIAL=0
*loop materials
*set var MATERIAL=Operation(MATERIAL(int)+1)
*end
*if(MATERIAL>1)
*messagebox - This program only allows one material
*endif
%=======================================================================
% MAT-fem_Beams 1.0  - MAT-fem is a learning tool for undestanding 
%                      the Finite Element Method with MATLAB and GiD
%=======================================================================
% PROBLEM TITLE = *GenData(1)
%
%  Material Properties
%
*loop materials
*format " layers = %10.2e; "
*MatProp(1);
*set var L=MatProp(1,int)
*set var N=MatProp(2,int)
young  = [
*for(i=1;i<=N-2;i=i+2)
*format " %17.9e "
*MatProp(2,*operation(i+1));
*end for
*format " %17.9e "
*MatProp(2,*operation(N))];
poiss = [
*for(i=1;i<=N-2;i=i+2)
*format " %17.9e "
*MatProp(3,*operation(i+1));
*end for
*format " %17.9e "
*MatProp(3,*operation(N))];
*if(strcmp(GenData(2),"No")==0)
*format "%1i"
  denss = zeros(*operation(L),1) ;
*else
denss = [
*for(i=1;i<=N-2;i=i+2)
*format " %17.9e "
*MatProp(4,*operation(i+1));
*end for
*format " %17.9e "
*MatProp(4,*operation(N))];
*endif
thickness = [
*for(i=1;i<=N-2;i=i+2)
*format " %17.9e "
*MatProp(5,*operation(i+1));
*end for
*format " %17.9e "
*MatProp(5,*operation(N))];
width = [
*for(i=1;i<=N-2;i=i+2)
*format " %17.9e "
*MatProp(6,*operation(i+1));
*end for
*format " %17.9e "
*MatProp(6,*operation(N))];
*end materials
%
% Coordinates
%
global coordinates
coordinates = [
*loop nodes
*format " %17.9e  "
*if(NodesNum == npoin)
*NodesCoord(1) ] ; 
*else
*NodesCoord(1) ;
*endif
*end nodes
%
% Elements
%
global elements
elements = [
*loop elems
*format " %6i  %6i  %6i  %6i  "
*if(nnode == 2)
*if(ElemsNum == nelem)
*ElemsConec(1) , *ElemsConec(2) ] ; 
*else
*ElemsConec(1) , *ElemsConec(2) ; 
*endif
*else
*if(ElemsNum == nelem)
*ElemsConec(1) , *ElemsConec(2) , *ElemsConec(3) ] ; 
*else
*ElemsConec(1) , *ElemsConec(2) , *ElemsConec(3) ; 
*endif
*endif
*end elems
%
% Fixed Nodes
%
fixnodes = [
*Set Cond Point_Constraints *nodes *or(1,int) *or(3,int) *or(5,int)
*Set var nod = 0
*loop nodes *OnlyInCond
*if(Cond(1,Int) == 1)
*Set var nod = nod + 1
*endif
*if(Cond(3,Int) == 1)
*Set var nod = nod + 1
*endif
*if(Cond(5,Int) == 1)
*Set var nod = nod + 1
*endif
*end nodes
*Set var nod2 = 1
*loop nodes *OnlyInCond
*if(Cond(1,Int) == 1)
*format " %6i %17.9e "
*if(nod==nod2)
*NodesNum() , 1 , *Cond(2) ] ;
*else
*NodesNum() , 1 , *Cond(2) ;
*endif
*Set var nod2 = nod2 + 1
*endif
*if(Cond(3,Int) == 1)
*format " %6i %17.9e "
*if(nod==nod2)
*NodesNum() , 2 , *Cond(4) ] ;
*else
*NodesNum() , 2 , *Cond(4) ;
*endif
*Set var nod2 = nod2 + 1
*endif
*if(Cond(5,Int) == 1)
*format " %6i %17.9e "
*if(nod==nod2)
*NodesNum() , 3 , *Cond(6) ] ;
*else
*NodesNum() , 3 , *Cond(6) ;
*endif
*Set var nod2 = nod2 + 1
*endif
*end nodes
%
% Point loads
%
*Set Cond Point_Load *nodes
*if((CondNumEntities(int)>0))
*Set var nod = 0
pointload = [
*loop nodes *OnlyInCond
*Set var nod = nod + 1
*format " %6i %17.9e "
*NodesNum , 1 , *cond(1,real) ;
*format " %6i %17.9e "
*NodesNum , 2 , *cond(2,real) ;
*format " %6i %17.9e "
*if(CondNumEntities(int)==nod)
*NodesNum , 3 , *cond(3,real) ] ;
*else
*NodesNum , 3 , *cond(3,real) ;
*endif
*end nodes
*else
pointload = [ ] ;
*endif
%
% Side loads
%
*Set Cond Uniform_Load *elems 
uniload = sparse ( *nelem , 2);
*if(CondNumEntities(int)>0)
*loop elems *OnlyInCond *and(1,int)
*format " %6i %17.9e "
uniload (*ElemsNum,1 ) = *cond(1) ;
*end elems
*loop elems *OnlyInCond *and(2,int)
*format " %6i %17.9e "
uniload (*ElemsNum,2 ) = *cond(2) ;
*end elems
*endif




