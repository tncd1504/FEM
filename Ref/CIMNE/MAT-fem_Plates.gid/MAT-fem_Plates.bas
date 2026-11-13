*loop elems
*if(elemsmat==0)
*messagebox - An element without any material was found, some posibilities are that you forget to asign a material to the problem or there is a repited entity over another - Process finished with error
*endif
*end
*loop nodes
*if(NodesCoord(3)==0)
*else
*messagebox - This is plates problem so z coordinate must be =0 for all nodes - Process finished with error
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
% MAT-fem_Plates 1.0 - MAT-fem is a learning tool for undestanding 
%                      the Finite Element Method with MATLAB and GiD
%=======================================================================
% PROBLEM TITLE = *GenData(1)
%
%  Material Properties
%
*loop materials
*format "  young  = %17.9e ;"
*MatProp(1)
*format "  poiss  = %17.9e ;"
*MatProp(2)
*if(strcmp(GenData(2),"No")==0)
  denss  =   0.000000000e+00 ;
*else
*format "  denss  = %17.9e ;"
*MatProp(3)
*endif
*format "  thick   = %17.9e ;"
*MatProp(4)
%
% Coordinates
%
global coordinates
coordinates = [
*loop nodes
*format " %17.9e  %17.9e "
*if(NodesNum == npoin)
*NodesCoord(1) , *NodesCoord(2) ] ; 
*else
*NodesCoord(1) , *NodesCoord(2) ;
*endif
*end nodes
%
% Elements
%
global elements
elements = [
*loop elems
*format " %6i  %6i  %6i  %6i  %6i  %6i  %6i  %6i  %6i"
*if(nnode == 3)
*if(ElemsNum == nelem)
*ElemsConec(1) , *ElemsConec(2) , *ElemsConec(3) ] ; 
*else
*ElemsConec(1) , *ElemsConec(2) , *ElemsConec(3) ; 
*endif
*endif
*if(nnode == 4)
*if(ElemsNum == nelem)
*ElemsConec(2) , *ElemsConec(3) , *ElemsConec(4) , *ElemsConec(1) ] ; 
*else
*ElemsConec(2) , *ElemsConec(3) , *ElemsConec(4) , *ElemsConec(1) ; 
*endif
*endif
*if(nnode == 6)
*if(ElemsNum == nelem)
*ElemsConec(1) , *ElemsConec(4) , *ElemsConec(2) , *ElemsConec(5) , *ElemsConec(3) , *ElemsConec(6) ] ; 
*else
*ElemsConec(1) , *ElemsConec(4) , *ElemsConec(2) , *ElemsConec(5) , *ElemsConec(3) , *ElemsConec(6) ; 
*endif
*endif
*if(nnode == 8)
*if(ElemsNum == nelem)
*ElemsConec(1) , *ElemsConec(5) , *ElemsConec(2) , *ElemsConec(6) , *ElemsConec(3) , *ElemsConec(7) , *ElemsConec(4) , *ElemsConec(8) ] ; 
*else
*ElemsConec(1) , *ElemsConec(5) , *ElemsConec(2) , *ElemsConec(6) , *ElemsConec(3) , *ElemsConec(7) , *ElemsConec(4) , *ElemsConec(8) ; 
*endif
*endif
*end elems
%
% Fixed Nodes
%
fixnodes = [
*Set Cond Point_Constraints *nodes *or(1,int) *or(3,int)  *or(5,int)
*Add Cond Line_Constraints *nodes *or(1,int) *or(3,int)  *or(5,int)
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
*if(CondNumEntities(int)==nod)
*NodesNum , 2 , *cond(2,real) ] ;
*else
*NodesNum , 2 , *cond(2,real) ;
*endif
*end nodes
*else
pointload = [ ] ;
*endif
%
% Side loadsss
%
*Set Cond Uniform_Load *elems 
uniload = sparse ( *nelem , 1 );
*if(CondNumEntities(int)>0)
*loop elems *OnlyInCond
*format " %6i %17.9e "
uniload (*ElemsNum ) = *cond(1) ;
*end elems
*endif



