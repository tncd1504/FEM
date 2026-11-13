function [Dsp_lyr Str_lyr ResStr_lyr] = Composite_Layers_Beam_Timoshenko(layers,young,shear,poiss,kz,width,thickness,coord_ZG,coord_zp,u)

%Evaluates the layer's values in order to see the results in a 2D graphic.
%Evaluates the displacements (Dsp_lyr) at the nodes and at the points between layers.
%Evaluates the stresses (Str_lyr), for each layer, at the gauss point and smooth the values
%to the nodes 
%Evaluates the resultant stresses (ResStr_lyr) on Gauss points for each layer.

  global coordinates;
  global elements;
  
  npnod  = size(coordinates,1);         % Number of nodes
  nelem  = size(elements,1);            % Number of elements
  nnode  = size(elements,2);            % Number of nodes por element
  dofpn  = 3;                           % Number of DOF per node
  dofpe  = nnode*dofpn;                 % Number of DOF per element
  nndof  = npnod*dofpn;                 % Number of total DO
  eqnum  = zeros(dofpe);                % Equation number list
  Dsp_lyr = zeros(npnod,3,layers+1);    % Create array for displacements
  Str_lyr = zeros(npnod,3,2*layers);    % Create array for stresses
  ResStr_lyr = zeros(nelem,3,layers);   % Create array for resultant stresses 

%% Layer Displacements
    % Finds the equation number list for the i-th node
    
dof_1=zeros(npnod,1); %dof_1 belong to the axial displacement 
dof_2=zeros(npnod,1); %dof_2 belong to the vertical displacement 
dof_3=zeros(npnod,1); %dof_3 belong to the rotation

for node = 1:npnod
    dof_1(node)=(node-1)*dofpn + 1;
    dof_2(node)=(node-1)*dofpn + 2;
    dof_3(node)=(node-1)*dofpn + 3;
end

    % Displacement field
    
for lyr = 1:layers+1
    Dsp_lyr(:,1,lyr) = u(dof_1) - coord_zp(lyr)*u(dof_3);
    Dsp_lyr(:,2,lyr) = u(dof_2);
    Dsp_lyr(:,3,lyr) = u(dof_3);
end

%% Layer Stresses and Resultant Stresses
    
    Da = zeros(2*layers,1);
    Db = zeros(2*layers,1);
    Ds = zeros(2*layers,1);
    
    for i=1:layers
      Da(2*(i-1)+1) = young(i);
      Da(2*(i-1)+2) = young(i);
      Db(2*(i-1)+1) = -young(i)*coord_zp(i);
      Db(2*(i-1)+2) = -young(i)*coord_zp(i+1);
      Ds(2*(i-1)+1) = kz*shear(i);
      Ds(2*(i-1)+2) = kz*shear(i);
    end
    
    Da_lyr  = zeros(layers,1);
    Db_lyr  = zeros(layers,1);
    Dab_lyr = zeros(layers,1);
    Ds_lyr  = zeros(layers,1);
    
 for i=1:layers
     Da_lyr(i) = width(i) * thickness (i) * young(i);
     Db_lyr(i) = (1/3)*((coord_ZG(i+1))^3-(coord_ZG(i))^3)*width(i)*young(i);
     Ds_lyr(i)= thickness(i)*width(i)*(young(i)/(2*(1+poiss(i))));
 end
 
 Ds_lyr=kz*Ds_lyr;
 
 
%  Element cycle.
  for ielem = 1 : nelem
    
    lnods(1:nnode) = elements(ielem,1:nnode); %vector nodos del elemento 
 
    coor_x(1:nnode) = coordinates(lnods(1:nnode),1); % Elem. X coordinate
 
    % Finds the equation number list for the i-th element
    
   for i=1:nnode
     ii = (i-1)*dofpn;
     for j =1:dofpn
       eqnum(ii+j) = (lnods(i)-1)*dofpn+j; % Build the equation number list
     end
    end
 
    % Recover the nodal displacements for the i-th element
    
    u_elem(1:dofpe)=u(eqnum(1:dofpe));

    len = coor_x(2) - coor_x(1);  % x_j > x_i

    % One gauss point for stress evaluation
    
    gaus0 =  0.0;    % One Gauss point for stresses evaluation

    bmat_a=[ -1/len, 0, 0, 1/len, 0, 0 ];
    
    bmat_b=[0, 0, -1/len, 0, 0, 1/len];
    
    bmat_s=[0, -1/len, -1/2, 0, 1/len, -1/2];
    
  
    
    Str1_g0 = (Da*bmat_a + Db*bmat_b)*transpose(u_elem);
    Str2_g0 = (Ds*bmat_s)*transpose(u_elem); 
   
 
    Str_lyr(lnods(1),1,:) = Str_lyr(lnods(1),1,:)+permute(Str1_g0,[2 3 1]);
    Str_lyr(lnods(2),1,:) = Str_lyr(lnods(2),1,:)+permute(Str1_g0,[2 3 1]);
    Str_lyr(lnods(1),2,:) = Str_lyr(lnods(1),2,:)+permute(Str2_g0,[2 3 1]);
    Str_lyr(lnods(2),2,:) = Str_lyr(lnods(2),2,:)+permute(Str2_g0,[2 3 1]);
    Str_lyr(lnods(1),3,:) = Str_lyr(lnods(1),3,:)+1;
    Str_lyr(lnods(2),3,:) = Str_lyr(lnods(2),3,:)+1;
    

    ResStr1_g0 = (Da_lyr*bmat_a) *transpose(u_elem);
    ResStr2_g0 = (Db_lyr*bmat_b)*transpose(u_elem); 
    ResStr3_g0 = (Ds_lyr*bmat_s)*transpose(u_elem); 
     
    ResStr_lyr(ielem,1,:)=permute(ResStr1_g0,[2 3 1]);
    ResStr_lyr(ielem,2,:)=permute(ResStr2_g0,[2 3 1]);
    ResStr_lyr(ielem,3,:)=permute(ResStr3_g0,[2 3 1]);
   
    
  end  % End element cycle
  
  for i = 1 : npnod
    Str_lyr(i,1,:) = Str_lyr(i,1,:)./Str_lyr(i,3,:);
    Str_lyr(i,2,:) = Str_lyr(i,2,:)./Str_lyr(i,3,:);   
  end
  

