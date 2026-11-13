function [D]=material_matrix(iopt,E,nuy)

%------------------------------------------------------------------------
%  Purpose:
%     determine the constitutive equation for isotropic material
%
%  Synopsis:
%     [D]= material_matrix(iopt,E,nuy) 
%
%  Variable Description:
%     E   - elastic modulus
%     nuy - poission's ratio   
%     iopt=1 - plane stress analysis
%     iopt=2 - plane strain analysis
%     iopt=3 - axisymmetric analysis
%     iopt=4 - three dimensional analysis
%------------------------------------------------------------------------

 if iopt==1        % plane stress
   D = E/(1-nuy*nuy)* ...
   [1       nuy   0; ...
    nuy     1     0; ...
    0       0     (1-nuy)/2];

 elseif iopt==2     % plane strain
   D = E/((1+nuy)*(1-2*nuy))* ...
   [(1-nuy)  nuy     0; 
    nuy     (1-nuy)  0;
    0        0      (1-2*nuy)/2];

 elseif iopt==3     % axisymmetry
   D = E/((1+nuy)*(1-2*nuy))* ...
   [(1-nuy)  nuy     nuy     0; 
    nuy     (1-nuy)  nuy     0;
    nuy      nuy    (1-nuy)  0;
    0        0       0      (1-2*nuy)/2];
 
 else     % three-dimension
   D = E/((1+nuy)*(1-2*nuy))* ...
   [(1-nuy)  nuy     nuy    0           0            0; 
    nuy     (1-nuy)  nuy    0           0            0;
    nuy      nuy    (1-nuy) 0           0            0;
    0        0       0     (1-2*nuy)/2  0            0;
    0        0       0      0          (1-2*nuy)/2   0;
    0        0       0      0           0           (1-2*nuy)/2];

 end
