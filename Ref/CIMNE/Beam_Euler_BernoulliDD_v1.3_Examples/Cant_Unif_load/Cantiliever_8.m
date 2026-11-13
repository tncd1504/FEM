%=======================================================================
% MAT-fem_Beams 1.0  - MAT-fem is a learning tool for undestanding 
%                      the Finite Element Method with MATLAB and GiD
%=======================================================================
% PROBLEM TITLE = Cantiliever
%
%  Material Properties
%
  young  =   4.761904762e+04 ;
  poiss  =  5.820105800e-02 ;
  denss  =   0.000000000e+00 ;
  area   =   1.600000000e-03 ;
  inertia=   2.133330000e-07 ;
%
% Coordinates
%
global coordinates
coordinates = [
   4.000000000e+00   ;
   3.500000000e+00   ;
   3.000000000e+00   ;
   2.500000000e+00   ;
   2.000000000e+00   ;
   1.500000000e+00   ;
   1.000000000e+00   ;
   5.000000000e-01   ;
   0.000000000e+00   ] ; 
%
% Elements
%
global elements
elements = [
      9   ,      8   ; 
      8   ,      7   ; 
      7   ,      6   ; 
      6   ,      5   ; 
      5   ,      4   ; 
      4   ,      3   ; 
      3   ,      2   ; 
      2   ,      1   ] ; 
%
% Fixed Nodes
%
fixnodes = [
      9  , 1 ,   0.000000000e+00  ;
      9  , 2 ,   0.000000000e+00  ] ;
%
% Point loads
%
pointload = [ ] ;
%
% Side loadsss
%
uniload = sparse ( 8 , 1 );
uniload (      1  ) =  -1.000000000e+00  ;
uniload (      2  ) =  -1.000000000e+00  ;
uniload (      3  ) =  -1.000000000e+00  ;
uniload (      4  ) =  -1.000000000e+00  ;
uniload (      5  ) =  -1.000000000e+00  ;
uniload (      6  ) =  -1.000000000e+00  ;
uniload (      7  ) =  -1.000000000e+00  ;
uniload (      8  ) =  -1.000000000e+00  ;



